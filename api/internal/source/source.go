package source

import (
	"context"
	"strings"

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

type Registry struct {
	sources map[string]Source
}

type Summary struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func NewRegistry(sources ...Source) *Registry {
	items := map[string]Source{}
	for _, item := range sources {
		items[item.ID()] = item
	}
	return &Registry{sources: items}
}

func (r *Registry) List() []Summary {
	items := make([]Summary, 0, len(r.sources))
	for _, item := range r.sources {
		items = append(items, Summary{ID: item.ID(), Name: item.Name()})
	}
	return items
}

func (r *Registry) Get(id string) (Source, bool) {
	item, ok := r.sources[id]
	return item, ok
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
