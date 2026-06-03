package source

import (
	"context"
	"strings"
	"sync"

	"gomic-api/internal/types"
)

type SeriesResult struct {
	SourceID string `json:"sourceId"`
	ID       string `json:"id"`
	Title    string `json:"title"`
	URL      string `json:"url"`
	CoverURL string `json:"coverUrl"`
}

type ChapterResult struct {
	ID          string  `json:"id"`
	Slug        string  `json:"slug"`
	NumberLabel string  `json:"numberLabel"`
	NumberSort  float64 `json:"numberSort"`
	Title       string  `json:"title"`
	PublishedAt string  `json:"publishedAt"`
}

type SeriesDetail struct {
	SeriesResult
	Synopsis     string          `json:"synopsis"`
	Type         string          `json:"type"`
	Status       string          `json:"status"`
	AuthorName   string          `json:"authorName"`
	ArtistName   string          `json:"artistName"`
	ReleaseYear  int             `json:"releaseYear"`
	Genres       []string        `json:"genres"`
	ChapterCount int             `json:"chapterCount"`
	Chapters     []ChapterResult `json:"chapters"`
}

type SeriesImport struct {
	Series   types.SeriesInput    `json:"series"`
	Chapters []types.ChapterInput `json:"chapters"`
}

type Source interface {
	ID() string
	Name() string
	Search(ctx context.Context, query string) ([]SeriesResult, error)
	Detail(ctx context.Context, id string) (SeriesDetail, error)
	ImportSeries(ctx context.Context, id string) (SeriesImport, error)
	Pages(ctx context.Context, seriesID, chapterSlug string) ([]types.ChapterPage, error)
}

type HealthCheck interface {
	Health(ctx context.Context) error
}

type Registry struct {
	mu      sync.RWMutex
	sources map[string]Source
}

type Summary struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Status struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Healthy bool   `json:"healthy"`
	Message string `json:"message"`
}

func NewRegistry(sources ...Source) *Registry {
	items := map[string]Source{}
	for _, item := range sources {
		items[item.ID()] = item
	}
	return &Registry{sources: items}
}

func (r *Registry) List() []Summary {
	r.mu.RLock()
	defer r.mu.RUnlock()
	items := make([]Summary, 0, len(r.sources))
	for _, item := range r.sources {
		items = append(items, Summary{ID: item.ID(), Name: item.Name()})
	}
	return items
}

func (r *Registry) Get(id string) (Source, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	item, ok := r.sources[id]
	return item, ok
}

func (r *Registry) Register(item Source) {
	if item == nil || strings.TrimSpace(item.ID()) == "" {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.sources[item.ID()] = item
}

func (r *Registry) Unregister(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.sources, id)
}

func (r *Registry) Status(ctx context.Context, id string) (Status, bool) {
	r.mu.RLock()
	item, ok := r.sources[id]
	r.mu.RUnlock()
	if !ok {
		return Status{}, false
	}
	status := Status{ID: item.ID(), Name: item.Name(), Healthy: true, Message: "ok"}
	if checker, ok := item.(HealthCheck); ok {
		if err := checker.Health(ctx); err != nil {
			status.Healthy = false
			status.Message = err.Error()
		}
	}
	return status, true
}

func MatchText(query string, values ...string) bool {
	query = strings.ToLower(strings.TrimSpace(query))
	if query == "" {
		return true
	}
	for _, value := range values {
		if strings.Contains(strings.ToLower(value), query) {
			return true
		}
	}
	return false
}
