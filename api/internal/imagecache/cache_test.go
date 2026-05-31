package imagecache

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"gomic-api/internal/types"
)

func TestCachePagesDownloadsRemoteImages(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Referer") != "https://images.test/" {
			t.Fatalf("missing image referer header: %q", r.Header.Get("Referer"))
		}
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write([]byte("fake image"))
	}))
	defer server.Close()

	cache := NewWithHeaders(t.TempDir(), map[string]string{"Referer": "https://images.test/"})
	pages, err := cache.CachePages(context.Background(), "series slug", "chapter/1", []types.ChapterPage{{PageNumber: 1, ImageURL: server.URL + "/page"}})
	if err != nil {
		t.Fatalf("cache pages: %v", err)
	}
	if len(pages) != 1 || !strings.HasPrefix(pages[0].ImageURL, "/uploads/source-cache/series-slug/chapter-1/0001-") || !strings.HasSuffix(pages[0].ImageURL, ".png") {
		t.Fatalf("unexpected cached page url: %#v", pages)
	}
}

func TestCachePagesKeepsLocalImages(t *testing.T) {
	cache := New(t.TempDir())
	pages, err := cache.CachePages(context.Background(), "series", "chapter", []types.ChapterPage{{PageNumber: 1, ImageURL: "/mock-pages/page.svg"}})
	if err != nil {
		t.Fatalf("cache local pages: %v", err)
	}
	if pages[0].ImageURL != "/mock-pages/page.svg" {
		t.Fatalf("expected local image to stay untouched, got %s", pages[0].ImageURL)
	}
}

func TestCachePruneRemovesOldFiles(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write([]byte("fake image"))
	}))
	defer server.Close()

	root := t.TempDir()
	cache := New(root)
	pages, err := cache.CachePages(context.Background(), "series", "chapter", []types.ChapterPage{{PageNumber: 1, ImageURL: server.URL + "/old"}})
	if err != nil {
		t.Fatalf("cache pages: %v", err)
	}
	cachedPath := filepath.Join(root, strings.TrimPrefix(pages[0].ImageURL, "/uploads/"))
	past := time.Now().Add(-72 * time.Hour)
	if err := os.Chtimes(cachedPath, past, past); err != nil {
		t.Fatalf("chtimes: %v", err)
	}
	removed, err := cache.Prune(24 * time.Hour)
	if err != nil {
		t.Fatalf("prune: %v", err)
	}
	if removed != 1 {
		t.Fatalf("expected 1 pruned file, got %d", removed)
	}
	if _, err := os.Stat(cachedPath); !os.IsNotExist(err) {
		t.Fatalf("expected cached file removed: err=%v", err)
	}
}
