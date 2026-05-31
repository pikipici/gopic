package source

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gomic-api/internal/types"
)

func TestJSONHTTPSourceFlow(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("User-Agent") != "GomicTest/1.0" || r.Header.Get("Referer") != "https://source.test/" {
			t.Fatalf("missing configured headers: ua=%q referer=%q", r.Header.Get("User-Agent"), r.Header.Get("Referer"))
		}
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/search":
			_ = json.NewEncoder(w).Encode(map[string]any{"results": []SeriesResult{{ID: "demo", Title: "Demo Series", URL: "https://example.test/demo", CoverURL: "https://example.test/cover.jpg"}}})
		case "/series/demo":
			_ = json.NewEncoder(w).Encode(SeriesDetail{SeriesResult: SeriesResult{ID: "demo", Title: "Demo Series"}, Synopsis: "Remote detail", Type: string(types.SeriesTypeManga), Status: string(types.SeriesStatusOngoing), ReleaseYear: 2026, ChapterCount: 1})
		case "/series/demo/import":
			_ = json.NewEncoder(w).Encode(SeriesImport{
				Series:   types.SeriesInput{Slug: "demo-series", Title: "Demo Series", Synopsis: "Remote import", CoverURL: "https://example.test/cover.jpg", Type: types.SeriesTypeManga, Status: types.SeriesStatusOngoing, ContentRating: types.ContentRatingTeen, Demographic: types.DemographicGeneral, ReleaseYear: 2026},
				Chapters: []types.ChapterInput{{Slug: "chapter-001", NumberLabel: "1", NumberSort: 1, Title: "Start", SourceChapterID: "c1"}},
			})
		case "/series/demo/chapters/chapter-001/pages":
			_ = json.NewEncoder(w).Encode(map[string]any{"pages": []types.ChapterPage{{PageNumber: 1, ImageURL: "https://example.test/page.jpg"}}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	source := NewJSONHTTPSourceWithHeaders("remote-demo", "Remote Demo", server.URL, map[string]string{"User-Agent": "GomicTest/1.0", "Referer": "https://source.test/"})
	results, err := source.Search(t.Context(), "demo")
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if len(results) != 1 || results[0].SourceID != "remote-demo" {
		t.Fatalf("unexpected search results: %#v", results)
	}
	detail, err := source.Detail(t.Context(), "demo")
	if err != nil {
		t.Fatalf("detail: %v", err)
	}
	if detail.SourceID != "remote-demo" || detail.Synopsis != "Remote detail" {
		t.Fatalf("unexpected detail: %#v", detail)
	}
	imported, err := source.ImportSeries(t.Context(), "demo")
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	if imported.Series.SourceID != "remote-demo" || imported.Series.SourceSeriesID != "demo" || imported.Series.SourceURL == "" {
		t.Fatalf("unexpected import metadata: %#v", imported.Series)
	}
	pages, err := source.Pages(t.Context(), "demo", "chapter-001")
	if err != nil {
		t.Fatalf("pages: %v", err)
	}
	if len(pages) != 1 || pages[0].ImageURL == "" {
		t.Fatalf("unexpected pages: %#v", pages)
	}
}
