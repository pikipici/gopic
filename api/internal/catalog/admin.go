package catalog

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"gomic-api/internal/types"
)

var (
	ErrInvalidSeriesInput          = errors.New("invalid series input")
	ErrInvalidChapterInput         = errors.New("invalid chapter input")
	ErrInvalidPagesInput           = errors.New("invalid pages input")
	ErrInvalidSourceExtensionInput = errors.New("invalid source extension input")
	ErrSeriesNotFound              = errors.New("series not found")
	ErrChapterNotFound             = errors.New("chapter not found")
)

type AdminStore interface {
	ListAdminSeries(ctx context.Context, query Query) ([]types.SeriesSummary, int, error)
	ListSourceExtensions(ctx context.Context) ([]types.SourceExtension, error)
	GetSourceExtension(ctx context.Context, id string) (types.SourceExtension, bool, error)
	UpsertSourceExtension(ctx context.Context, input types.SourceExtensionInput) (types.SourceExtension, error)
	UpdateSourceExtension(ctx context.Context, id string, patch types.SourceExtensionPatch) (types.SourceExtension, bool, error)
	DeleteSourceExtension(ctx context.Context, id string) (bool, error)
	UpsertSeries(ctx context.Context, input types.SeriesInput) (types.SeriesDetail, error)
	UpsertChapter(ctx context.Context, seriesSlug string, input types.ChapterInput) (types.ChapterSummary, error)
	ReplaceChapterPages(ctx context.Context, seriesSlug, chapterSlug string, pages []types.ChapterPage) (types.ChapterReader, error)
}

type sourceExtensionStore struct {
	items map[string]types.SourceExtension
}

func (r *Repository) ListAdminSeries(ctx context.Context, query Query) ([]types.SeriesSummary, int, error) {
	return r.List(ctx, query)
}

func (r *Repository) ListSourceExtensions(ctx context.Context) ([]types.SourceExtension, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	items := make([]types.SourceExtension, 0, len(r.extensions().items))
	for _, item := range r.extensions().items {
		items = append(items, item)
	}
	sort.SliceStable(items, func(i, j int) bool { return items[i].Name < items[j].Name })
	return items, nil
}

func (r *Repository) UpsertSourceExtension(ctx context.Context, input types.SourceExtensionInput) (types.SourceExtension, error) {
	if err := ctx.Err(); err != nil {
		return types.SourceExtension{}, err
	}
	input.ID = strings.TrimSpace(input.ID)
	input.Name = strings.TrimSpace(input.Name)
	if input.ID == "" || input.Name == "" {
		return types.SourceExtension{}, ErrInvalidSourceExtensionInput
	}
	if input.Kind == "" {
		input.Kind = "json-http"
	}
	now := time.Now().UTC().Format(time.RFC3339)
	item := types.SourceExtension{
		ID:           input.ID,
		Name:         input.Name,
		Kind:         input.Kind,
		BaseURL:      input.BaseURL,
		Enabled:      input.Enabled,
		Capabilities: input.Capabilities,
		Config:       input.Config,
		LastError:    input.LastError,
		UpdatedAt:    now,
	}
	if item.Config == nil {
		item.Config = map[string]any{}
	}
	r.extensions().items[item.ID] = item
	return item, nil
}

func (r *Repository) GetSourceExtension(ctx context.Context, id string) (types.SourceExtension, bool, error) {
	if err := ctx.Err(); err != nil {
		return types.SourceExtension{}, false, err
	}
	item, ok := r.extensions().items[id]
	return item, ok, nil
}

func (r *Repository) UpdateSourceExtension(ctx context.Context, id string, patch types.SourceExtensionPatch) (types.SourceExtension, bool, error) {
	if err := ctx.Err(); err != nil {
		return types.SourceExtension{}, false, err
	}
	item, ok := r.extensions().items[id]
	if !ok {
		return types.SourceExtension{}, false, nil
	}
	if patch.Name != nil {
		item.Name = strings.TrimSpace(*patch.Name)
	}
	if patch.Kind != nil {
		item.Kind = strings.TrimSpace(*patch.Kind)
	}
	if patch.BaseURL != nil {
		item.BaseURL = strings.TrimSpace(*patch.BaseURL)
	}
	if patch.Enabled != nil {
		item.Enabled = *patch.Enabled
	}
	if patch.Capabilities != nil {
		item.Capabilities = *patch.Capabilities
	}
	if patch.Config != nil {
		item.Config = patch.Config
	}
	if item.ID == "" || item.Name == "" {
		return types.SourceExtension{}, false, ErrInvalidSourceExtensionInput
	}
	if item.Kind == "" {
		item.Kind = "json-http"
	}
	item.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	r.extensions().items[id] = item
	return item, true, nil
}

func (r *Repository) DeleteSourceExtension(ctx context.Context, id string) (bool, error) {
	if err := ctx.Err(); err != nil {
		return false, err
	}
	if _, ok := r.extensions().items[id]; !ok {
		return false, nil
	}
	delete(r.extensions().items, id)
	return true, nil
}

func (r *Repository) UpsertSeries(ctx context.Context, input types.SeriesInput) (types.SeriesDetail, error) {
	if err := validateSeriesInput(input); err != nil {
		return types.SeriesDetail{}, err
	}
	if err := ctx.Err(); err != nil {
		return types.SeriesDetail{}, err
	}

	series := types.Series{
		Slug:           input.Slug,
		Title:          input.Title,
		AltTitles:      input.AltTitles,
		Synopsis:       input.Synopsis,
		CoverURL:       input.CoverURL,
		Type:           input.Type,
		Status:         input.Status,
		ContentRating:  input.ContentRating,
		Demographic:    input.Demographic,
		AuthorName:     input.AuthorName,
		ArtistName:     input.ArtistName,
		ReleaseYear:    input.ReleaseYear,
		Genres:         input.Genres,
		Featured:       input.Featured,
		UpdatedAt:      time.Now().UTC().Format(time.RFC3339),
		SourceID:       input.SourceID,
		SourceSeriesID: input.SourceSeriesID,
		SourceURL:      input.SourceURL,
	}

	for index, item := range r.series {
		if item.Slug == input.Slug {
			series.Chapters = item.Chapters
			r.series[index] = series
			return detailFromSeries(series), nil
		}
	}
	r.series = append(r.series, series)
	return detailFromSeries(series), nil
}

func (r *Repository) UpsertChapter(ctx context.Context, seriesSlug string, input types.ChapterInput) (types.ChapterSummary, error) {
	if err := validateChapterInput(input); err != nil {
		return types.ChapterSummary{}, err
	}
	if err := ctx.Err(); err != nil {
		return types.ChapterSummary{}, err
	}

	seriesIndex := r.findSeriesIndex(seriesSlug)
	if seriesIndex < 0 {
		return types.ChapterSummary{}, ErrSeriesNotFound
	}
	chapter := types.Chapter{
		Slug:            input.Slug,
		NumberLabel:     input.NumberLabel,
		NumberSort:      input.NumberSort,
		Title:           input.Title,
		PublishedAt:     normalizePublishedAt(input.PublishedAt),
		SourceChapterID: input.SourceChapterID,
	}
	chapters := r.series[seriesIndex].Chapters
	for index, item := range chapters {
		if item.Slug == input.Slug {
			chapter.Pages = item.Pages
			chapters[index] = chapter
			r.series[seriesIndex].Chapters = sortChapters(chapters)
			return summarizeChapter(chapter), nil
		}
	}
	chapters = append(chapters, chapter)
	r.series[seriesIndex].Chapters = sortChapters(chapters)
	return summarizeChapter(chapter), nil
}

func (r *Repository) ReplaceChapterPages(ctx context.Context, seriesSlug, chapterSlug string, pages []types.ChapterPage) (types.ChapterReader, error) {
	if err := validatePagesInput(pages); err != nil {
		return types.ChapterReader{}, err
	}
	if err := ctx.Err(); err != nil {
		return types.ChapterReader{}, err
	}

	seriesIndex := r.findSeriesIndex(seriesSlug)
	if seriesIndex < 0 {
		return types.ChapterReader{}, ErrSeriesNotFound
	}
	for chapterIndex, chapter := range r.series[seriesIndex].Chapters {
		if chapter.Slug == chapterSlug {
			chapter.Pages = normalizePages(pages)
			r.series[seriesIndex].Chapters[chapterIndex] = chapter
			reader := types.ChapterReader{Chapter: chapter}
			reader.Series.Slug = r.series[seriesIndex].Slug
			reader.Series.Title = r.series[seriesIndex].Title
			return reader, nil
		}
	}
	return types.ChapterReader{}, ErrChapterNotFound
}

func (r *Repository) findSeriesIndex(slug string) int {
	for index, series := range r.series {
		if series.Slug == slug {
			return index
		}
	}
	return -1
}

func detailFromSeries(series types.Series) types.SeriesDetail {
	chapters := make([]types.ChapterSummary, 0, len(series.Chapters))
	for _, chapter := range series.Chapters {
		chapters = append(chapters, summarizeChapter(chapter))
	}
	return types.SeriesDetail{SeriesSummary: summarize(series), Chapters: chapters}
}

func validateSeriesInput(input types.SeriesInput) error {
	if strings.TrimSpace(input.Slug) == "" || strings.TrimSpace(input.Title) == "" {
		return ErrInvalidSeriesInput
	}
	if input.ReleaseYear != 0 && (input.ReleaseYear < 1900 || input.ReleaseYear > 2200) {
		return ErrInvalidSeriesInput
	}
	return nil
}

func validateChapterInput(input types.ChapterInput) error {
	if strings.TrimSpace(input.Slug) == "" || strings.TrimSpace(input.NumberLabel) == "" {
		return ErrInvalidChapterInput
	}
	return nil
}

func validatePagesInput(pages []types.ChapterPage) error {
	if len(pages) == 0 {
		return ErrInvalidPagesInput
	}
	seen := map[int]bool{}
	for _, page := range pages {
		if page.PageNumber <= 0 || strings.TrimSpace(page.ImageURL) == "" || seen[page.PageNumber] {
			return ErrInvalidPagesInput
		}
		seen[page.PageNumber] = true
	}
	return nil
}

func normalizePublishedAt(value string) string {
	if strings.TrimSpace(value) != "" {
		return value
	}
	return time.Now().UTC().Format(time.RFC3339)
}

func normalizePages(pages []types.ChapterPage) []types.ChapterPage {
	items := append([]types.ChapterPage(nil), pages...)
	sort.SliceStable(items, func(i, j int) bool {
		return items[i].PageNumber < items[j].PageNumber
	})
	return items
}

func sortChapters(chapters []types.Chapter) []types.Chapter {
	items := append([]types.Chapter(nil), chapters...)
	sort.SliceStable(items, func(i, j int) bool {
		return items[i].NumberSort > items[j].NumberSort
	})
	return items
}

func slugifyGenre(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = strings.ReplaceAll(value, " ", "-")
	return value
}
