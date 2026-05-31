package imagecache

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"gomic-api/internal/types"
)

func TestCachePagesKeepsOriginalURLWhenDownloadFails(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/slow.jpg" {
			time.Sleep(50 * time.Millisecond)
			return
		}
		w.Header().Set("Content-Type", "image/jpeg")
		_, _ = w.Write([]byte("fake image"))
	}))
	defer server.Close()

	cache := New(filepath.Join(t.TempDir(), "uploads"))
	cache.Client = &http.Client{Timeout: 5 * time.Millisecond}

	pages, err := cache.CachePages(context.Background(), "series", "chapter", []types.ChapterPage{
		{PageNumber: 1, ImageURL: server.URL + "/slow.jpg"},
		{PageNumber: 2, ImageURL: server.URL + "/ok.jpg"},
	})
	if err != nil {
		t.Fatalf("CachePages returned error: %v", err)
	}
	if pages[0].ImageURL != server.URL+"/slow.jpg" {
		t.Fatalf("failed download should keep original URL, got %q", pages[0].ImageURL)
	}
	if !strings.HasPrefix(pages[1].ImageURL, "/uploads/source-cache/series/chapter/") {
		t.Fatalf("successful download should be cached, got %q", pages[1].ImageURL)
	}
}
