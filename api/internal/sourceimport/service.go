package sourceimport

import (
	"context"
	"errors"

	"gomic-api/internal/catalog"
	"gomic-api/internal/imagecache"
	"gomic-api/internal/source"
	"gomic-api/internal/types"
)

var (
	ErrSourceNotFound  = errors.New("source not found")
	ErrSeriesNotLinked = errors.New("series is not linked to a source")
	ErrSeriesNotFound  = errors.New("series not found")
)

type Service struct {
	catalog catalog.Store
	admin   catalog.AdminStore
	sources *source.Registry
	cache   *imagecache.Cache
}

type Result struct {
	Series           types.SeriesDetail `json:"series"`
	ChaptersImported int                `json:"chaptersImported"`
}

type Progress struct {
	Progress int
	Message  string
}

type ProgressFunc func(Progress)

type ImportOptions struct {
	ChapterLimit int
	FetchPages   bool
	CachePages   bool
}

func DefaultImportOptions() ImportOptions {
	return ImportOptions{FetchPages: true, CachePages: true}
}

func New(catalogStore catalog.Store, adminStore catalog.AdminStore, sources *source.Registry, cache *imagecache.Cache) *Service {
	return &Service{catalog: catalogStore, admin: adminStore, sources: sources, cache: cache}
}

func (s *Service) Import(ctx context.Context, sourceID, sourceSeriesID string) (Result, error) {
	return s.ImportWithProgress(ctx, sourceID, sourceSeriesID, nil)
}

func (s *Service) ImportWithProgress(ctx context.Context, sourceID, sourceSeriesID string, report ProgressFunc) (Result, error) {
	return s.ImportWithOptions(ctx, sourceID, sourceSeriesID, DefaultImportOptions(), report)
}

func (s *Service) ImportWithOptions(ctx context.Context, sourceID, sourceSeriesID string, options ImportOptions, report ProgressFunc) (Result, error) {
	item, ok := s.sources.Get(sourceID)
	if !ok {
		return Result{}, ErrSourceNotFound
	}
	return s.importFromSource(ctx, item, sourceSeriesID, normalizeOptions(options), report)
}

func (s *Service) SyncSeries(ctx context.Context, slug string) (Result, error) {
	return s.SyncSeriesWithProgress(ctx, slug, nil)
}

func (s *Service) SyncSeriesWithProgress(ctx context.Context, slug string, report ProgressFunc) (Result, error) {
	return s.SyncSeriesWithOptions(ctx, slug, DefaultImportOptions(), report)
}

func (s *Service) SyncSeriesWithOptions(ctx context.Context, slug string, options ImportOptions, report ProgressFunc) (Result, error) {
	reportProgress(report, 12, "Loading linked series "+slug)
	detail, ok, err := s.catalog.Detail(ctx, slug)
	if err != nil {
		return Result{}, err
	}
	if !ok {
		return Result{}, ErrSeriesNotFound
	}
	if detail.SourceID == "" || detail.SourceSeriesID == "" {
		return Result{}, ErrSeriesNotLinked
	}
	return s.ImportWithOptions(ctx, detail.SourceID, detail.SourceSeriesID, options, report)
}

func (s *Service) importFromSource(ctx context.Context, item source.Source, id string, options ImportOptions, report ProgressFunc) (Result, error) {
	reportProgress(report, 15, "Fetching source metadata")
	imported, err := item.ImportSeries(ctx, id)
	if err != nil {
		return Result{}, err
	}
	imported.Chapters = selectChapters(imported.Chapters, options.ChapterLimit)
	if s.cache != nil && options.CachePages {
		if coverURL, err := s.cache.CacheCover(ctx, imported.Series.Slug, imported.Series.CoverURL); err == nil {
			imported.Series.CoverURL = coverURL
		}
	}
	reportProgress(report, 25, "Saving series "+imported.Series.Slug)
	series, err := s.admin.UpsertSeries(ctx, imported.Series)
	if err != nil {
		return Result{}, err
	}
	chapterCount := len(imported.Chapters)
	for index, chapterInput := range imported.Chapters {
		chapterNumber := index + 1
		baseProgress := chapterProgress(chapterNumber, chapterCount, 30, 85)
		reportProgress(report, baseProgress, "Saving chapter "+chapterInput.Slug)
		if _, err := s.admin.UpsertChapter(ctx, imported.Series.Slug, chapterInput); err != nil {
			return Result{}, err
		}
		if !options.FetchPages {
			continue
		}
		reportProgress(report, baseProgress+2, "Fetching pages for "+chapterInput.Slug)
		pages, err := item.Pages(ctx, id, chapterInput.Slug)
		if err != nil {
			return Result{}, err
		}
		if s.cache != nil && options.CachePages {
			reportProgress(report, baseProgress+4, "Caching pages for "+chapterInput.Slug)
			pages, err = s.cache.CachePages(ctx, imported.Series.Slug, chapterInput.Slug, pages)
			if err != nil {
				return Result{}, err
			}
		}
		reportProgress(report, baseProgress+6, "Replacing pages for "+chapterInput.Slug)
		if _, err := s.admin.ReplaceChapterPages(ctx, imported.Series.Slug, chapterInput.Slug, pages); err != nil {
			return Result{}, err
		}
	}
	reportProgress(report, 92, "Finalizing import for "+imported.Series.Slug)
	return Result{Series: series, ChaptersImported: len(imported.Chapters)}, nil
}

func normalizeOptions(options ImportOptions) ImportOptions {
	if options.ChapterLimit < 0 {
		options.ChapterLimit = 0
	}
	return options
}

func selectChapters(chapters []types.ChapterInput, limit int) []types.ChapterInput {
	if limit <= 0 || limit >= len(chapters) {
		return chapters
	}
	return chapters[:limit]
}

func reportProgress(report ProgressFunc, progress int, message string) {
	if report == nil {
		return
	}
	if progress < 0 {
		progress = 0
	}
	if progress > 99 {
		progress = 99
	}
	report(Progress{Progress: progress, Message: message})
}

func chapterProgress(chapterNumber, chapterCount, start, end int) int {
	if chapterCount <= 0 {
		return end
	}
	span := end - start
	return start + (span*(chapterNumber-1))/chapterCount
}
