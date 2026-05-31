package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gomic-api/internal/catalog"
	"gomic-api/internal/seed"
)

func TestHandlerHealthAndCatalogEndpoints(t *testing.T) {
	handler := NewHandler(catalog.NewRepository(seed.Series())).Routes()

	tests := []struct {
		name string
		path string
		code int
	}{
		{name: "health", path: "/healthz", code: http.StatusOK},
		{name: "genres", path: "/api/v1/genres", code: http.StatusOK},
		{name: "series list", path: "/api/v1/series?genre=Action&sort=chapters", code: http.StatusOK},
		{name: "series detail", path: "/api/v1/series/nighthawk-protocol", code: http.StatusOK},
		{name: "chapter reader", path: "/api/v1/series/nighthawk-protocol/chapters/chapter-003", code: http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, tt.path, nil)
			handler.ServeHTTP(recorder, request)

			if recorder.Code != tt.code {
				t.Fatalf("expected status %d, got %d body=%s", tt.code, recorder.Code, recorder.Body.String())
			}
			if got := recorder.Header().Get("Content-Type"); got != "application/json" {
				t.Fatalf("expected application/json content type, got %q", got)
			}
		})
	}
}

func TestHandlerSeriesListEnvelopeMeta(t *testing.T) {
	handler := NewHandler(catalog.NewRepository(seed.Series())).Routes()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/series?limit=999&offset=-1", nil)

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Data []any          `json:"data"`
		Meta map[string]int `json:"meta"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Meta["limit"] != 24 || response.Meta["offset"] != 0 {
		t.Fatalf("expected normalized pagination meta, got %#v", response.Meta)
	}
	if response.Meta["total"] != len(seed.Series()) {
		t.Fatalf("expected total %d, got %d", len(seed.Series()), response.Meta["total"])
	}
}

func TestHandlerNotFoundEnvelope(t *testing.T) {
	handler := NewHandler(catalog.NewRepository(seed.Series())).Routes()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/series/missing", nil)

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", recorder.Code)
	}
	var response struct {
		Error apiError `json:"error"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Error.Code != "not_found" {
		t.Fatalf("expected not_found error, got %#v", response.Error)
	}
}
