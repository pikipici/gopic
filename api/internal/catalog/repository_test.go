package catalog

import (
	"context"
	"testing"

	"gomic-api/internal/seed"
)

func TestRepositoryListFiltersAndSorts(t *testing.T) {
	repo := NewRepository(seed.Series())

	items, total, err := repo.List(context.Background(), Query{Genre: "Action", Sort: "chapters"})
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if total != 1 {
		t.Fatalf("expected 1 total item, got %d", total)
	}
	if len(items) != 1 || items[0].Slug != "nighthawk-protocol" {
		t.Fatalf("expected nighthawk-protocol result, got %#v", items)
	}
	if items[0].ChapterCount != 3 {
		t.Fatalf("expected chapter count 3, got %d", items[0].ChapterCount)
	}
	if items[0].LatestChapter == nil || items[0].LatestChapter.Slug != "chapter-003" {
		t.Fatalf("expected latest chapter-003, got %#v", items[0].LatestChapter)
	}
}

func TestRepositoryPaginationNormalizesBounds(t *testing.T) {
	repo := NewRepository(seed.Series())

	items, total, err := repo.List(context.Background(), Query{Limit: 999, Offset: -10})
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if total != len(seed.Series()) {
		t.Fatalf("expected total %d, got %d", len(seed.Series()), total)
	}
	if len(items) != len(seed.Series()) {
		t.Fatalf("expected all seed items, got %d", len(items))
	}
}

func TestRepositoryDetailAndChapter(t *testing.T) {
	repo := NewRepository(seed.Series())

	detail, ok, err := repo.Detail(context.Background(), "nighthawk-protocol")
	if err != nil {
		t.Fatalf("Detail returned error: %v", err)
	}
	if !ok {
		t.Fatal("expected series detail to be found")
	}
	if detail.Title != "Nighthawk Protocol" || len(detail.Chapters) != 3 {
		t.Fatalf("unexpected detail: %#v", detail)
	}

	reader, ok, err := repo.Chapter(context.Background(), "nighthawk-protocol", "chapter-003")
	if err != nil {
		t.Fatalf("Chapter returned error: %v", err)
	}
	if !ok {
		t.Fatal("expected chapter reader to be found")
	}
	if reader.Series.Slug != "nighthawk-protocol" || len(reader.Chapter.Pages) != 4 {
		t.Fatalf("unexpected reader payload: %#v", reader)
	}
}

func TestRepositoryNotFound(t *testing.T) {
	repo := NewRepository(seed.Series())

	if _, ok, err := repo.Detail(context.Background(), "missing"); err != nil || ok {
		t.Fatalf("expected missing detail, ok=%v err=%v", ok, err)
	}
	if _, ok, err := repo.Chapter(context.Background(), "missing", "chapter-001"); err != nil || ok {
		t.Fatalf("expected missing chapter, ok=%v err=%v", ok, err)
	}
}
