package catalog

import (
	"context"
	"slices"
	"sort"
	"strings"

	"gomic-api/internal/types"
)

type Query struct {
	Search      string
	Genre       string
	Type        string
	Status      string
	Demographic string
	Rating      string
	Sort        string
	Limit       int
	Offset      int
}

type Store interface {
	List(ctx context.Context, query Query) ([]types.SeriesSummary, int, error)
	Detail(ctx context.Context, slug string) (types.SeriesDetail, bool, error)
	Chapter(ctx context.Context, seriesSlug, chapterSlug string) (types.ChapterReader, bool, error)
	Genres(ctx context.Context) ([]string, error)
}

type Repository struct {
	series []types.Series
}

func NewRepository(series []types.Series) *Repository {
	return &Repository{series: series}
}

func (r *Repository) List(ctx context.Context, query Query) ([]types.SeriesSummary, int, error) {
	items := make([]types.Series, 0, len(r.series))
	needle := strings.ToLower(strings.TrimSpace(query.Search))

	for _, series := range r.series {
		if err := ctx.Err(); err != nil {
			return nil, 0, err
		}
		if needle != "" && !strings.Contains(strings.ToLower(strings.Join(searchFields(series), " ")), needle) {
			continue
		}
		if query.Genre != "" && !slices.Contains(series.Genres, query.Genre) {
			continue
		}
		if query.Type != "" && string(series.Type) != query.Type {
			continue
		}
		if query.Status != "" && string(series.Status) != query.Status {
			continue
		}
		if query.Demographic != "" && string(series.Demographic) != query.Demographic {
			continue
		}
		if query.Rating != "" && string(series.ContentRating) != query.Rating {
			continue
		}
		items = append(items, series)
	}

	sortSeries(items, query.Sort)
	total := len(items)
	limit := normalizeLimit(query.Limit)
	offset := normalizeOffset(query.Offset)
	if offset > total {
		return []types.SeriesSummary{}, total, nil
	}
	end := min(offset+limit, total)

	summaries := make([]types.SeriesSummary, 0, end-offset)
	for _, series := range items[offset:end] {
		summaries = append(summaries, summarize(series))
	}
	return summaries, total, nil
}

func (r *Repository) Detail(ctx context.Context, slug string) (types.SeriesDetail, bool, error) {
	for _, series := range r.series {
		if err := ctx.Err(); err != nil {
			return types.SeriesDetail{}, false, err
		}
		if series.Slug == slug {
			chapters := make([]types.ChapterSummary, 0, len(series.Chapters))
			for _, chapter := range series.Chapters {
				chapters = append(chapters, summarizeChapter(chapter))
			}
			return types.SeriesDetail{SeriesSummary: summarize(series), Chapters: chapters}, true, nil
		}
	}
	return types.SeriesDetail{}, false, nil
}

func (r *Repository) Chapter(ctx context.Context, seriesSlug, chapterSlug string) (types.ChapterReader, bool, error) {
	for _, series := range r.series {
		if err := ctx.Err(); err != nil {
			return types.ChapterReader{}, false, err
		}
		if series.Slug != seriesSlug {
			continue
		}
		for _, chapter := range series.Chapters {
			if chapter.Slug == chapterSlug {
				reader := types.ChapterReader{Chapter: chapter}
				reader.Series.Slug = series.Slug
				reader.Series.Title = series.Title
				return reader, true, nil
			}
		}
	}
	return types.ChapterReader{}, false, nil
}

func (r *Repository) Genres(ctx context.Context) ([]string, error) {
	seen := map[string]bool{}
	for _, series := range r.series {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		for _, genre := range series.Genres {
			seen[genre] = true
		}
	}
	genres := make([]string, 0, len(seen))
	for genre := range seen {
		genres = append(genres, genre)
	}
	sort.Strings(genres)
	return genres, nil
}

func NormalizePagination(query Query) (int, int) {
	return normalizeLimit(query.Limit), normalizeOffset(query.Offset)
}

func SummarizeSeries(series types.Series) types.SeriesSummary {
	return summarize(series)
}

func SummarizeChapter(chapter types.Chapter) types.ChapterSummary {
	return summarizeChapter(chapter)
}

func searchFields(series types.Series) []string {
	fields := []string{series.Title, series.Synopsis, series.AuthorName, series.ArtistName}
	fields = append(fields, series.AltTitles...)
	return fields
}

func sortSeries(items []types.Series, mode string) {
	sort.SliceStable(items, func(i, j int) bool {
		a, b := items[i], items[j]
		switch mode {
		case "title":
			return a.Title < b.Title
		case "chapters":
			return len(a.Chapters) > len(b.Chapters)
		case "year":
			return a.ReleaseYear > b.ReleaseYear
		default:
			return a.UpdatedAt > b.UpdatedAt
		}
	})
}

func summarize(series types.Series) types.SeriesSummary {
	var latest *types.ChapterSummary
	if len(series.Chapters) > 0 {
		chapter := summarizeChapter(series.Chapters[0])
		latest = &chapter
	}

	return types.SeriesSummary{
		Slug:           series.Slug,
		Title:          series.Title,
		AltTitles:      series.AltTitles,
		Synopsis:       series.Synopsis,
		CoverURL:       series.CoverURL,
		Type:           series.Type,
		Status:         series.Status,
		ContentRating:  series.ContentRating,
		Demographic:    series.Demographic,
		AuthorName:     series.AuthorName,
		ArtistName:     series.ArtistName,
		ReleaseYear:    series.ReleaseYear,
		Genres:         series.Genres,
		ChapterCount:   len(series.Chapters),
		LatestChapter:  latest,
		Featured:       series.Featured,
		UpdatedAt:      series.UpdatedAt,
		SourceID:       series.SourceID,
		SourceSeriesID: series.SourceSeriesID,
		SourceURL:      series.SourceURL,
		LastSyncedAt:   series.LastSyncedAt,
	}
}

func summarizeChapter(chapter types.Chapter) types.ChapterSummary {
	return types.ChapterSummary{
		Slug:        chapter.Slug,
		NumberLabel: chapter.NumberLabel,
		NumberSort:  chapter.NumberSort,
		Title:       chapter.Title,
		PublishedAt: chapter.PublishedAt,
		PageCount:   len(chapter.Pages),
	}
}

func normalizeLimit(limit int) int {
	if limit <= 0 || limit > 100 {
		return 24
	}
	return limit
}

func normalizeOffset(offset int) int {
	if offset < 0 {
		return 0
	}
	return offset
}
