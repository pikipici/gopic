package source

import (
	"context"
	"fmt"
	"time"

	"gomic-api/internal/types"
)

type MockSource struct{}

func NewMockSource() MockSource {
	return MockSource{}
}

func (MockSource) ID() string { return "mock-mihon" }

func (MockSource) Name() string { return "Mock Mihon Source" }

func (MockSource) Health(ctx context.Context) error { return ctx.Err() }

func (s MockSource) Search(ctx context.Context, query string) ([]SeriesResult, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	items := []SeriesResult{
		{SourceID: s.ID(), ID: "neon-rain", Title: "Neon Rain Protocol", URL: "mock://neon-rain", CoverURL: "/mock-covers/nighthawk.svg"},
		{SourceID: s.ID(), ID: "moonlit-vendor", Title: "Moonlit Vendor Guild", URL: "mock://moonlit-vendor", CoverURL: "/mock-covers/orbit-cafe.svg"},
	}
	filtered := []SeriesResult{}
	for _, item := range items {
		if MatchText(query, item.Title, item.ID) {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

func (s MockSource) Detail(ctx context.Context, id string) (SeriesDetail, error) {
	imported, err := s.ImportSeries(ctx, id)
	if err != nil {
		return SeriesDetail{}, err
	}
	chapters := make([]ChapterResult, 0, len(imported.Chapters))
	for _, chapter := range imported.Chapters {
		chapters = append(chapters, ChapterResult{
			ID:          chapter.SourceChapterID,
			Slug:        chapter.Slug,
			NumberLabel: chapter.NumberLabel,
			NumberSort:  chapter.NumberSort,
			Title:       chapter.Title,
			PublishedAt: chapter.PublishedAt,
		})
	}
	return SeriesDetail{
		SeriesResult: SeriesResult{SourceID: s.ID(), ID: id, Title: imported.Series.Title, URL: imported.Series.SourceURL, CoverURL: imported.Series.CoverURL},
		Synopsis:     imported.Series.Synopsis,
		Type:         string(imported.Series.Type),
		Status:       string(imported.Series.Status),
		AuthorName:   imported.Series.AuthorName,
		ArtistName:   imported.Series.ArtistName,
		ReleaseYear:  imported.Series.ReleaseYear,
		Genres:       imported.Series.Genres,
		ChapterCount: len(chapters),
		Chapters:     chapters,
	}, nil
}

func (s MockSource) ImportSeries(ctx context.Context, id string) (SeriesImport, error) {
	if err := ctx.Err(); err != nil {
		return SeriesImport{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	switch id {
	case "neon-rain":
		return SeriesImport{
			Series: types.SeriesInput{
				Slug: "neon-rain-protocol", Title: "Neon Rain Protocol", AltTitles: []string{"NRP"},
				Synopsis: "A courier follows encrypted graffiti through a city where every storm rewrites the network.",
				CoverURL: "/mock-covers/nighthawk.svg", Type: types.SeriesTypeManhwa, Status: types.SeriesStatusOngoing,
				ContentRating: types.ContentRatingTeen, Demographic: types.DemographicSeinen,
				AuthorName: "Mock Source", ArtistName: "Mock Source", ReleaseYear: 2026,
				Genres: []string{"Action", "Cyberpunk"}, Featured: false,
				SourceID: s.ID(), SourceSeriesID: id, SourceURL: "mock://neon-rain",
			},
			Chapters: []types.ChapterInput{
				{Slug: "chapter-002", NumberLabel: "Chapter 2", NumberSort: 2, Title: "Rain Key", PublishedAt: now, SourceChapterID: "neon-rain-002"},
				{Slug: "chapter-001", NumberLabel: "Chapter 1", NumberSort: 1, Title: "Static Umbrella", PublishedAt: now, SourceChapterID: "neon-rain-001"},
			},
		}, nil
	case "moonlit-vendor":
		return SeriesImport{
			Series: types.SeriesInput{
				Slug: "moonlit-vendor-guild", Title: "Moonlit Vendor Guild", AltTitles: []string{},
				Synopsis: "A night market merchant trades cursed snacks for forgotten memories.",
				CoverURL: "/mock-covers/orbit-cafe.svg", Type: types.SeriesTypeManga, Status: types.SeriesStatusOngoing,
				ContentRating: types.ContentRatingAll, Demographic: types.DemographicGeneral,
				AuthorName: "Mock Source", ArtistName: "Mock Source", ReleaseYear: 2026,
				Genres: []string{"Slice of Life", "Fantasy"}, Featured: false,
				SourceID: s.ID(), SourceSeriesID: id, SourceURL: "mock://moonlit-vendor",
			},
			Chapters: []types.ChapterInput{
				{Slug: "chapter-001", NumberLabel: "Chapter 1", NumberSort: 1, Title: "Lantern Receipt", PublishedAt: now, SourceChapterID: "moonlit-vendor-001"},
			},
		}, nil
	default:
		return SeriesImport{}, fmt.Errorf("source series not found")
	}
}

func (s MockSource) Pages(ctx context.Context, seriesID, chapterSlug string) ([]types.ChapterPage, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	prefix := "nighthawk"
	if seriesID == "moonlit-vendor" {
		prefix = "orbit-cafe"
	}
	pages := make([]types.ChapterPage, 0, 3)
	for index := 1; index <= 3; index++ {
		pages = append(pages, types.ChapterPage{
			PageNumber: index,
			ImageURL:   fmt.Sprintf("/mock-pages/%s-001-%d.svg", prefix, index),
			Width:      900,
			Height:     1280,
		})
	}
	return pages, nil
}
