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

func TestCacheCoverCachesRemoteURL(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/webp")
		_, _ = w.Write([]byte("fake cover"))
	}))
	defer server.Close()

	cache := New(filepath.Join(t.TempDir(), "uploads"))
	coverURL, err := cache.CacheCover(context.Background(), "series", server.URL+"/cover.webp?X-Amz-Expires=86400")
	if err != nil {
		t.Fatalf("CacheCover returned error: %v", err)
	}
	if !strings.HasPrefix(coverURL, "/uploads/source-cache/series/cover/") {
		t.Fatalf("successful cover download should be cached, got %q", coverURL)
	}
	if strings.Contains(coverURL, "X-Amz") {
		t.Fatalf("cached cover URL should not keep signed query params, got %q", coverURL)
	}
}

func TestCacheCoverKeepsLocalURL(t *testing.T) {
	cache := New(filepath.Join(t.TempDir(), "uploads"))
	coverURL, err := cache.CacheCover(context.Background(), "series", "/mock-covers/test.svg")
	if err != nil {
		t.Fatalf("CacheCover returned error: %v", err)
	}
	if coverURL != "/mock-covers/test.svg" {
		t.Fatalf("local cover should be kept, got %q", coverURL)
	}
}
