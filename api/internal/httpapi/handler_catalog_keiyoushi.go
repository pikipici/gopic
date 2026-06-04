package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"gomic-api/internal/types"
)

type keiyoushiEntry struct {
	Name    string             `json:"name"`
	Pkg     string             `json:"pkg"`
	Apk     string             `json:"apk"`
	Lang    string             `json:"lang"`
	Code    int                `json:"code"`
	Version string             `json:"version"`
	Nsfw    int                `json:"nsfw"`
	Sources []keiyoushiSource  `json:"sources"`
}

type keiyoushiSource struct {
	Name    string `json:"name"`
	Lang    string `json:"lang"`
	ID      string `json:"id"`
	BaseURL string `json:"baseUrl"`
}

type adapterInfo struct {
	Adapter bool   `json:"adapter"`
	Name    string `json:"name"`
	Kind    string `json:"kind"`
	BaseURL string `json:"baseUrl"`
}

type adapterMap map[string]adapterInfo

func (h *Handler) loadAdapterMap() adapterMap {
	data, err := os.ReadFile(h.adapterMapPath)
	if err != nil {
		slog.Warn("cannot read adapter map", "path", h.adapterMapPath, "error", err)
		return adapterMap{}
	}
	var result adapterMap
	if err := json.Unmarshal(data, &result); err != nil {
		slog.Warn("invalid adapter map", "path", h.adapterMapPath, "error", err)
		return adapterMap{}
	}
	return result
}

func (h *Handler) mergeCatalogs(ctx context.Context) ([]types.AvailableSourceExtension, error) {
	local, localErr := h.availableExtensionsFromLocal()
	if localErr != nil {
		local = nil
		slog.Warn("local catalog unavailable, using keiyoushi only", "error", localErr)
	}
	keiyoushi, keiyoushiErr := h.availableExtensionsFromKeiyoushi()
	if keiyoushiErr != nil {
		if local == nil {
			return nil, keiyoushiErr
		}
		slog.Warn("keiyoushi catalog unavailable, using local only", "error", keiyoushiErr)
		return local, nil
	}

	adapters := h.loadAdapterMap()

	seen := map[string]bool{}
	merged := make([]types.AvailableSourceExtension, 0, len(keiyoushi)+len(local))

	for _, item := range local {
		if seen[item.ID] {
			continue
		}
		seen[item.ID] = true
		item.AdapterAvailable = h.isAdapterAvailable(item.ID, adapters)
		merged = append(merged, item)
	}

	for _, item := range keiyoushi {
		if seen[item.ID] {
			continue
		}
		seen[item.ID] = true
		item.AdapterAvailable = h.isAdapterAvailable(item.ID, adapters)
		merged = append(merged, item)
	}

	sort.Slice(merged, func(i, j int) bool {
		if merged[i].Language != merged[j].Language {
			return merged[i].Language < merged[j].Language
		}
		return merged[i].Name < merged[j].Name
	})
	return merged, nil
}

func (h *Handler) isAdapterAvailable(sourceID string, adapters adapterMap) bool {
	if info, ok := adapters[sourceID]; ok && info.Adapter {
		return true
	}
	if _, ok := h.sources.Get(sourceID); ok {
		return true
	}
	return false
}

func (h *Handler) availableExtensionsFromLocal() ([]types.AvailableSourceExtension, error) {
	data, err := h.readExtensionCatalog()
	if err != nil {
		return nil, err
	}
	var catalogIndex types.SourceExtensionCatalog
	if err := json.Unmarshal(data, &catalogIndex); err != nil {
		return nil, fmt.Errorf("extension catalog is invalid")
	}
	items := make([]types.AvailableSourceExtension, 0, len(catalogIndex.Extensions))
	seen := map[string]bool{}
	for _, item := range catalogIndex.Extensions {
		input := normalizeExtensionInput(types.SourceExtensionInput{
			ID:           item.ID,
			Name:         item.Name,
			Kind:         item.Kind,
			BaseURL:      item.BaseURL,
			Enabled:      true,
			Capabilities: item.Capabilities,
			Config:       item.Config,
		})
		if seen[input.ID] || validateExtensionInput(input) != nil {
			continue
		}
		seen[input.ID] = true
		item.ID = input.ID
		item.Name = input.Name
		item.Kind = input.Kind
		item.BaseURL = input.BaseURL
		item.Capabilities = input.Capabilities
		if item.Config == nil {
			item.Config = map[string]any{}
		}
		items = append(items, item)
	}
	return items, nil
}

func (h *Handler) availableExtensionsFromKeiyoushi() ([]types.AvailableSourceExtension, error) {
	entries, err := h.fetchKeiyoushiCatalog()
	if err != nil {
		return nil, err
	}
	items := make([]types.AvailableSourceExtension, 0, len(entries)*2)
	seen := map[string]bool{}
	for _, entry := range entries {
		for _, source := range entry.Sources {
			sourceID := strings.TrimSpace(source.ID)
			if sourceID == "" || seen[sourceID] {
				continue
			}
			seen[sourceID] = true
			lang := source.Lang
			if lang == "" || lang == "all" {
				lang = entry.Lang
			}
			if lang == "all" || lang == "" {
				lang = "en"
			}
			item := types.AvailableSourceExtension{
				ID:           sourceID,
				Name:         source.Name,
				Kind:         "mihon-source",
				BaseURL:      source.BaseURL,
				Description:  fmt.Sprintf("%s — %s", entry.Name, source.Name),
				Language:     lang,
				Version:      entry.Version,
				Author:       "Keiyoushi",
				Homepage:     source.BaseURL,
				Capabilities: []string{"detail", "import", "pages"},
				Config: map[string]any{
					"nsfw":     entry.Nsfw,
					"pkg":      entry.Pkg,
					"sourceId": source.ID,
				},
			}
			items = append(items, item)
		}
	}
	return items, nil
}

type keiyoushiCatalogCache struct {
	data      []keiyoushiEntry
	fetchedAt time.Time
}

var (
	keiyoushiCache   keiyoushiCatalogCache
	keiyoushiCacheMu sync.Mutex
	keiyoushiCacheTTL = 5 * time.Minute
)

func (h *Handler) fetchKeiyoushiCatalog() ([]keiyoushiEntry, error) {
	keiyoushiCacheMu.Lock()
	if time.Since(keiyoushiCache.fetchedAt) < keiyoushiCacheTTL && keiyoushiCache.data != nil {
		data := keiyoushiCache.data
		keiyoushiCacheMu.Unlock()
		return data, nil
	}
	keiyoushiCacheMu.Unlock()

	url := strings.TrimSpace(h.keiyoushiCatalogURL)
	if url == "" {
		return nil, fmt.Errorf("keiyoushi catalog URL is not configured")
	}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("keiyoushi catalog URL is invalid")
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("keiyoushi catalog cannot be fetched")
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("keiyoushi catalog returned %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 8*1024*1024))
	if err != nil {
		return nil, fmt.Errorf("keiyoushi catalog cannot be read")
	}
	var entries []keiyoushiEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		return nil, fmt.Errorf("keiyoushi catalog is invalid JSON")
	}

	keiyoushiCacheMu.Lock()
	keiyoushiCache.data = entries
	keiyoushiCache.fetchedAt = time.Now()
	keiyoushiCacheMu.Unlock()

	return entries, nil
}
