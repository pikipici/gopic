package sourceimport

import (
	"context"
	"testing"

	"gomic-api/internal/catalog"
	"gomic-api/internal/source"
)

func TestImportWithOptionsLimitsChaptersAndSkipsPages(t *testing.T) {
	repo := catalog.NewRepository(nil)
	service := New(repo, repo, source.NewRegistry(source.NewMockSource()), nil)

	result, err := service.ImportWithOptions(context.Background(), "mock-mihon", "neon-rain", ImportOptions{ChapterLimit: 1}, nil)
	if err != nil {
		t.Fatalf("import with options: %v", err)
	}
	if result.ChaptersImported != 1 {
		t.Fatalf("expected 1 imported chapter, got %d", result.ChaptersImported)
	}
	detail, ok, err := repo.Detail(context.Background(), result.Series.Slug)
	if err != nil || !ok {
		t.Fatalf("detail after import: ok=%v err=%v", ok, err)
	}
	if len(detail.Chapters) != 1 {
		t.Fatalf("expected 1 persisted chapter, got %d", len(detail.Chapters))
	}
	if detail.Chapters[0].PageCount != 0 {
		t.Fatalf("expected pages to be skipped, got %d", detail.Chapters[0].PageCount)
	}
}

func TestImportWithProgressReportsChapterSteps(t *testing.T) {
	repo := catalog.NewRepository(nil)
	service := New(repo, repo, source.NewRegistry(source.NewMockSource()), nil)

	updates := []Progress{}
	result, err := service.ImportWithProgress(context.Background(), "mock-mihon", "neon-rain", func(progress Progress) {
		updates = append(updates, progress)
	})
	if err != nil {
		t.Fatalf("import with progress: %v", err)
	}
	if result.ChaptersImported == 0 {
		t.Fatalf("expected imported chapters")
	}
	if len(updates) < 8 {
		t.Fatalf("expected granular progress updates, got %d", len(updates))
	}
	if updates[0].Progress != 15 || updates[0].Message == "" {
		t.Fatalf("unexpected first update: %#v", updates[0])
	}
	last := updates[len(updates)-1]
	if last.Progress != 92 || last.Message == "" {
		t.Fatalf("unexpected last update: %#v", last)
	}
}
