package imagecache

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gomic-api/internal/types"
)

type Cache struct {
	RootDir string
	BaseURL string
	Headers map[string]string
	Client  *http.Client
}

func New(rootDir string) *Cache {
	return NewWithHeaders(rootDir, nil)
}

func NewWithHeaders(rootDir string, headers map[string]string) *Cache {
	if rootDir == "" {
		rootDir = "./uploads"
	}
	return &Cache{RootDir: rootDir, BaseURL: "/uploads", Headers: cleanHeaders(headers), Client: &http.Client{Timeout: 30 * time.Second}}
}

func (c *Cache) CachePages(ctx context.Context, seriesSlug, chapterSlug string, pages []types.ChapterPage) ([]types.ChapterPage, error) {
	items := append([]types.ChapterPage(nil), pages...)
	for index, page := range items {
		if !isRemote(page.ImageURL) {
			continue
		}
		cachedURL, err := c.cacheRemote(ctx, seriesSlug, chapterSlug, page)
		if err != nil {
			// Keep the original remote URL so a slow image host does not fail the whole import.
			continue
		}
		items[index].ImageURL = cachedURL
	}
	return items, nil
}

func (c *Cache) cacheRemote(ctx context.Context, seriesSlug, chapterSlug string, page types.ChapterPage) (string, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, page.ImageURL, nil)
	if err != nil {
		return "", err
	}
	for key, value := range c.Headers {
		request.Header.Set(key, value)
	}
	response, err := c.client().Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", fmt.Errorf("cache image %s: status %d", page.ImageURL, response.StatusCode)
	}

	ext := extensionFromURL(page.ImageURL)
	if ext == "" {
		ext = extensionFromContentType(response.Header.Get("Content-Type"))
	}
	if ext == "" {
		ext = ".jpg"
	}
	name := fmt.Sprintf("%04d-%s%s", page.PageNumber, shortHash(page.ImageURL), ext)
	dir := filepath.Join(c.RootDir, "source-cache", safeSegment(seriesSlug), safeSegment(chapterSlug))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(dir, name)
	file, err := os.Create(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	if _, err := io.Copy(file, response.Body); err != nil {
		return "", err
	}
	return strings.TrimRight(c.BaseURL, "/") + "/source-cache/" + safeSegment(seriesSlug) + "/" + safeSegment(chapterSlug) + "/" + name, nil
}

func (c *Cache) Prune(olderThan time.Duration) (int, error) {
	if olderThan <= 0 {
		return 0, nil
	}
	root := filepath.Join(c.RootDir, "source-cache")
	if _, err := os.Stat(root); err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}
	cutoff := time.Now().Add(-olderThan)
	removed := 0
	err := filepath.Walk(root, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if path == root || info.IsDir() {
			return nil
		}
		if info.ModTime().Before(cutoff) {
			if err := os.Remove(path); err != nil {
				return err
			}
			removed++
		}
		return nil
	})
	if err != nil {
		return removed, err
	}
	_ = removeEmptyDirs(root)
	return removed, nil
}

func removeEmptyDirs(root string) error {
	entries, err := os.ReadDir(root)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		path := filepath.Join(root, entry.Name())
		if err := removeEmptyDirs(path); err != nil {
			return err
		}
		nested, err := os.ReadDir(path)
		if err != nil {
			return err
		}
		if len(nested) == 0 {
			_ = os.Remove(path)
		}
	}
	return nil
}

func (c *Cache) client() *http.Client {
	if c.Client != nil {
		return c.Client
	}
	return http.DefaultClient
}

func isRemote(value string) bool {
	return strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://")
}

func extensionFromURL(value string) string {
	parsed, err := url.Parse(value)
	if err != nil {
		return ""
	}
	ext := strings.ToLower(filepath.Ext(parsed.Path))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif":
		return ext
	default:
		return ""
	}
}

func extensionFromContentType(value string) string {
	value = strings.ToLower(strings.Split(value, ";")[0])
	switch value {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	case "image/avif":
		return ".avif"
	default:
		return ""
	}
}

func safeSegment(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	var builder strings.Builder
	for _, char := range value {
		if (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char == '-' || char == '_' {
			builder.WriteRune(char)
			continue
		}
		builder.WriteByte('-')
	}
	if builder.Len() == 0 {
		return "unknown"
	}
	return builder.String()
}

func shortHash(value string) string {
	sum := sha1.Sum([]byte(value))
	return hex.EncodeToString(sum[:])[:10]
}
