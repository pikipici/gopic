package httpapi

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"gomic-api/internal/catalog"
	"gomic-api/internal/seed"
)

func TestAdminLoginAndSeriesCreate(t *testing.T) {
	handler := NewHandler(catalog.NewRepository(seed.Series()), WithAdminToken("dev-token")).Routes()

	loginBody := bytes.NewBufferString(`{"token":"dev-token"}`)
	loginRecorder := httptest.NewRecorder()
	handler.ServeHTTP(loginRecorder, httptest.NewRequest(http.MethodPost, "/api/v1/admin/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("expected login 200, got %d body=%s", loginRecorder.Code, loginRecorder.Body.String())
	}

	seriesJSON := `{
		"slug":"test-series",
		"title":"Test Series",
		"synopsis":"Admin-created test item",
		"coverUrl":"/mock-covers/test.svg",
		"type":"comic",
		"status":"ongoing",
		"contentRating":"teen",
		"demographic":"general",
		"authorName":"Admin",
		"artistName":"Admin",
		"releaseYear":2026,
		"genres":["Test"],
		"featured":false
	}`
	createRecorder := httptest.NewRecorder()
	createRequest := httptest.NewRequest(http.MethodPost, "/api/v1/admin/series", bytes.NewBufferString(seriesJSON))
	createRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(createRecorder, createRequest)
	if createRecorder.Code != http.StatusOK {
		t.Fatalf("expected create 200, got %d body=%s", createRecorder.Code, createRecorder.Body.String())
	}

	detailRecorder := httptest.NewRecorder()
	handler.ServeHTTP(detailRecorder, httptest.NewRequest(http.MethodGet, "/api/v1/series/test-series", nil))
	if detailRecorder.Code != http.StatusOK {
		t.Fatalf("expected public detail for created series, got %d body=%s", detailRecorder.Code, detailRecorder.Body.String())
	}
	var response struct {
		Data struct {
			Slug  string `json:"slug"`
			Title string `json:"title"`
		} `json:"data"`
	}
	if err := json.NewDecoder(detailRecorder.Body).Decode(&response); err != nil {
		t.Fatalf("decode detail: %v", err)
	}
	if response.Data.Slug != "test-series" || response.Data.Title != "Test Series" {
		t.Fatalf("unexpected detail payload: %#v", response.Data)
	}
}

func TestAdminChapterAndPagesCreate(t *testing.T) {
	handler := NewHandler(catalog.NewRepository(seed.Series()), WithAdminToken("dev-token")).Routes()

	chapterJSON := `{
		"slug":"chapter-99",
		"numberLabel":"99",
		"numberSort":99,
		"title":"Final Test"
	}`
	chapterRecorder := httptest.NewRecorder()
	chapterRequest := httptest.NewRequest(http.MethodPost, "/api/v1/admin/series/nighthawk-protocol/chapters", bytes.NewBufferString(chapterJSON))
	chapterRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(chapterRecorder, chapterRequest)
	if chapterRecorder.Code != http.StatusOK {
		t.Fatalf("expected chapter create 200, got %d body=%s", chapterRecorder.Code, chapterRecorder.Body.String())
	}

	pagesJSON := `{"pages":[
		{"pageNumber":2,"imageUrl":"/mock-pages/final-02.svg"},
		{"pageNumber":1,"imageUrl":"/mock-pages/final-01.svg"}
	]}`
	pagesRecorder := httptest.NewRecorder()
	pagesRequest := httptest.NewRequest(http.MethodPut, "/api/v1/admin/series/nighthawk-protocol/chapters/chapter-99/pages", bytes.NewBufferString(pagesJSON))
	pagesRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(pagesRecorder, pagesRequest)
	if pagesRecorder.Code != http.StatusOK {
		t.Fatalf("expected pages replace 200, got %d body=%s", pagesRecorder.Code, pagesRecorder.Body.String())
	}

	readerRecorder := httptest.NewRecorder()
	handler.ServeHTTP(readerRecorder, httptest.NewRequest(http.MethodGet, "/api/v1/series/nighthawk-protocol/chapters/chapter-99", nil))
	if readerRecorder.Code != http.StatusOK {
		t.Fatalf("expected public reader 200, got %d body=%s", readerRecorder.Code, readerRecorder.Body.String())
	}
	var response struct {
		Data struct {
			Chapter struct {
				Slug  string `json:"slug"`
				Pages []struct {
					PageNumber int `json:"pageNumber"`
				} `json:"pages"`
			} `json:"chapter"`
		} `json:"data"`
	}
	if err := json.NewDecoder(readerRecorder.Body).Decode(&response); err != nil {
		t.Fatalf("decode reader: %v", err)
	}
	if response.Data.Chapter.Slug != "chapter-99" || len(response.Data.Chapter.Pages) != 2 || response.Data.Chapter.Pages[0].PageNumber != 1 {
		t.Fatalf("unexpected reader payload: %#v", response.Data.Chapter)
	}
}

func TestAdminChapterCBZImport(t *testing.T) {
	uploadDir := t.TempDir()
	handler := NewHandler(catalog.NewRepository(seed.Series()), WithAdminToken("dev-token"), WithUploadDir(uploadDir)).Routes()

	chapterJSON := `{"slug":"chapter-cbz","numberLabel":"CBZ","numberSort":100,"title":"Imported"}`
	chapterRecorder := httptest.NewRecorder()
	chapterRequest := httptest.NewRequest(http.MethodPost, "/api/v1/admin/series/nighthawk-protocol/chapters", bytes.NewBufferString(chapterJSON))
	chapterRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(chapterRecorder, chapterRequest)
	if chapterRecorder.Code != http.StatusOK {
		t.Fatalf("expected chapter create 200, got %d body=%s", chapterRecorder.Code, chapterRecorder.Body.String())
	}

	var archive bytes.Buffer
	zipWriter := zip.NewWriter(&archive)
	for _, name := range []string{"002.png", "001.jpg"} {
		entry, err := zipWriter.Create(name)
		if err != nil {
			t.Fatalf("create zip entry: %v", err)
		}
		if _, err := entry.Write([]byte("fake image")); err != nil {
			t.Fatalf("write zip entry: %v", err)
		}
	}
	if err := zipWriter.Close(); err != nil {
		t.Fatalf("close zip: %v", err)
	}

	var body bytes.Buffer
	multipartWriter := multipart.NewWriter(&body)
	part, err := multipartWriter.CreateFormFile("file", "chapter.cbz")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write(archive.Bytes()); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := multipartWriter.Close(); err != nil {
		t.Fatalf("close multipart: %v", err)
	}

	importRecorder := httptest.NewRecorder()
	importRequest := httptest.NewRequest(http.MethodPost, "/api/v1/admin/series/nighthawk-protocol/chapters/chapter-cbz/import-cbz", &body)
	importRequest.Header.Set("Authorization", "Bearer dev-token")
	importRequest.Header.Set("Content-Type", multipartWriter.FormDataContentType())
	handler.ServeHTTP(importRecorder, importRequest)
	if importRecorder.Code != http.StatusOK {
		t.Fatalf("expected import 200, got %d body=%s", importRecorder.Code, importRecorder.Body.String())
	}
	if _, err := os.Stat(uploadDir + "/chapters/nighthawk-protocol/chapter-cbz/0001.jpg"); err != nil {
		t.Fatalf("expected extracted first page: %v", err)
	}
}

func TestAdminSourceSearchAndImport(t *testing.T) {
	handler := NewHandler(catalog.NewRepository(seed.Series()), WithAdminToken("dev-token")).Routes()

	searchRecorder := httptest.NewRecorder()
	searchRequest := httptest.NewRequest(http.MethodGet, "/api/v1/admin/sources/mock-mihon/search?q=neon", nil)
	searchRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(searchRecorder, searchRequest)
	if searchRecorder.Code != http.StatusOK {
		t.Fatalf("expected source search 200, got %d body=%s", searchRecorder.Code, searchRecorder.Body.String())
	}

	detailRecorder := httptest.NewRecorder()
	detailRequest := httptest.NewRequest(http.MethodGet, "/api/v1/admin/sources/mock-mihon/series/neon-rain", nil)
	detailRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(detailRecorder, detailRequest)
	if detailRecorder.Code != http.StatusOK {
		t.Fatalf("expected source detail 200, got %d body=%s", detailRecorder.Code, detailRecorder.Body.String())
	}

	importRecorder := httptest.NewRecorder()
	importRequest := httptest.NewRequest(http.MethodPost, "/api/v1/admin/sources/mock-mihon/import", bytes.NewBufferString(`{"id":"neon-rain"}`))
	importRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(importRecorder, importRequest)
	if importRecorder.Code != http.StatusAccepted {
		t.Fatalf("expected source import 202, got %d body=%s", importRecorder.Code, importRecorder.Body.String())
	}
	waitForJob(t, handler, importRecorder.Body.Bytes())

	syncRecorder := httptest.NewRecorder()
	syncRequest := httptest.NewRequest(http.MethodPost, "/api/v1/admin/series/neon-rain-protocol/sync-source", nil)
	syncRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(syncRecorder, syncRequest)
	if syncRecorder.Code != http.StatusAccepted {
		t.Fatalf("expected series source sync 202, got %d body=%s", syncRecorder.Code, syncRecorder.Body.String())
	}
	waitForJob(t, handler, syncRecorder.Body.Bytes())

	jobsRecorder := httptest.NewRecorder()
	jobsRequest := httptest.NewRequest(http.MethodGet, "/api/v1/admin/jobs?limit=5", nil)
	jobsRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(jobsRecorder, jobsRequest)
	if jobsRecorder.Code != http.StatusOK {
		t.Fatalf("expected jobs list 200, got %d body=%s", jobsRecorder.Code, jobsRecorder.Body.String())
	}
	var jobsResponse struct {
		Data []struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		} `json:"data"`
	}
	if err := json.NewDecoder(jobsRecorder.Body).Decode(&jobsResponse); err != nil {
		t.Fatalf("decode jobs list: %v", err)
	}
	if len(jobsResponse.Data) < 2 || jobsResponse.Data[0].Status == "" {
		t.Fatalf("unexpected jobs list payload: %#v", jobsResponse.Data)
	}

	readerRecorder := httptest.NewRecorder()
	handler.ServeHTTP(readerRecorder, httptest.NewRequest(http.MethodGet, "/api/v1/series/neon-rain-protocol/chapters/chapter-001", nil))
	if readerRecorder.Code != http.StatusOK {
		t.Fatalf("expected imported reader 200, got %d body=%s", readerRecorder.Code, readerRecorder.Body.String())
	}
}

func TestAdminChapterValidation(t *testing.T) {
	handler := NewHandler(catalog.NewRepository(seed.Series()), WithAdminToken("dev-token")).Routes()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/admin/series/missing/chapters", bytes.NewBufferString(`{"slug":"x","numberLabel":"1"}`))
	request.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected missing series 404, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestAdminRequiresToken(t *testing.T) {
	handler := NewHandler(catalog.NewRepository(seed.Series()), WithAdminToken("dev-token")).Routes()
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/admin/series", nil))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

func TestAdminDisabledWithoutToken(t *testing.T) {
	handler := NewHandler(catalog.NewRepository(seed.Series())).Routes()
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/v1/admin/login", bytes.NewBufferString(`{"token":"x"}`)))
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", recorder.Code)
	}
}

func waitForJob(t *testing.T, handler http.Handler, body []byte) {
	t.Helper()
	var createResponse struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &createResponse); err != nil {
		t.Fatalf("decode job create response: %v", err)
	}
	for range 50 {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, "/api/v1/admin/jobs/"+createResponse.Data.ID, nil)
		request.Header.Set("Authorization", "Bearer dev-token")
		handler.ServeHTTP(recorder, request)
		if recorder.Code != http.StatusOK {
			t.Fatalf("expected job detail 200, got %d body=%s", recorder.Code, recorder.Body.String())
		}
		var detail struct {
			Data struct {
				Status  string `json:"status"`
				Message string `json:"message"`
			} `json:"data"`
		}
		if err := json.NewDecoder(recorder.Body).Decode(&detail); err != nil {
			t.Fatalf("decode job detail: %v", err)
		}
		if detail.Data.Status == "completed" {
			return
		}
		if detail.Data.Status == "failed" {
			t.Fatalf("job failed: %s", detail.Data.Message)
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("job did not complete")
}
