package catalog

import (
	"context"
	"testing"

	"gomic-api/internal/seed"
	"gomic-api/internal/types"
)

func TestRepositoryUpsertSeriesCreatesAndUpdates(t *testing.T) {
	repo := NewRepository(seed.Series())
	input := types.SeriesInput{
		Slug:          "admin-test-series",
		Title:         "Admin Test Series",
		Synopsis:      "Created from admin test",
		CoverURL:      "/mock-covers/admin-test.svg",
		Type:          types.SeriesTypeComic,
		Status:        types.SeriesStatusOngoing,
		ContentRating: types.ContentRatingTeen,
		Demographic:   types.DemographicGeneral,
		AuthorName:    "Admin",
		ArtistName:    "Admin",
		ReleaseYear:   2026,
		Genres:        []string{"Admin", "Smoke Test"},
	}

	created, err := repo.UpsertSeries(context.Background(), input)
	if err != nil {
		t.Fatalf("UpsertSeries create returned error: %v", err)
	}
	if created.Slug != input.Slug || created.Title != input.Title {
		t.Fatalf("unexpected created detail: %#v", created)
	}

	input.Title = "Updated Admin Test Series"
	updated, err := repo.UpsertSeries(context.Background(), input)
	if err != nil {
		t.Fatalf("UpsertSeries update returned error: %v", err)
	}
	if updated.Title != input.Title {
		t.Fatalf("expected updated title %q, got %q", input.Title, updated.Title)
	}

	detail, ok, err := repo.Detail(context.Background(), input.Slug)
	if err != nil {
		t.Fatalf("Detail returned error: %v", err)
	}
	if !ok || detail.Title != input.Title {
		t.Fatalf("expected detail readback with updated title, ok=%v detail=%#v", ok, detail)
	}
}

func TestRepositoryUpsertSeriesValidatesInput(t *testing.T) {
	repo := NewRepository(seed.Series())
	_, err := repo.UpsertSeries(context.Background(), types.SeriesInput{Title: "Missing slug"})
	if err != ErrInvalidSeriesInput {
		t.Fatalf("expected ErrInvalidSeriesInput, got %v", err)
	}
}

func TestSlugifyGenre(t *testing.T) {
	if got := slugifyGenre("  Martial Arts  "); got != "martial-arts" {
		t.Fatalf("expected martial-arts, got %q", got)
	}
}
