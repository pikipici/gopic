package httpapi

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"gomic-api/internal/catalog"
	"gomic-api/internal/seed"
	"gomic-api/internal/types"
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

func TestAdminExtensionsListAndPatch(t *testing.T) {
	repo := catalog.NewRepository(seed.Series())
	_, err := repo.UpsertSourceExtension(context.Background(), types.SourceExtensionInput{
		ID:           "mock-mihon",
		Name:         "Mock Mihon Source",
		Kind:         "mock",
		Enabled:      true,
		Capabilities: []string{"search", "detail", "import", "pages"},
		Config:       map[string]any{},
	})
	if err != nil {
		t.Fatalf("seed extension: %v", err)
	}
	handler := NewHandler(repo, WithAdminToken("dev-token")).Routes()

	listRecorder := httptest.NewRecorder()
	listRequest := httptest.NewRequest(http.MethodGet, "/api/v1/admin/extensions", nil)
	listRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(listRecorder, listRequest)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("expected extensions list 200, got %d body=%s", listRecorder.Code, listRecorder.Body.String())
	}

	statusRecorder := httptest.NewRecorder()
	statusRequest := httptest.NewRequest(http.MethodGet, "/api/v1/admin/extensions/mock-mihon/status", nil)
	statusRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(statusRecorder, statusRequest)
	if statusRecorder.Code != http.StatusOK {
		t.Fatalf("expected extension status 200, got %d body=%s", statusRecorder.Code, statusRecorder.Body.String())
	}

	patchRecorder := httptest.NewRecorder()
	patchRequest := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/extensions/mock-mihon", bytes.NewBufferString(`{"enabled":false}`))
	patchRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(patchRecorder, patchRequest)
	if patchRecorder.Code != http.StatusOK {
		t.Fatalf("expected extension patch 200, got %d body=%s", patchRecorder.Code, patchRecorder.Body.String())
	}

	searchRecorder := httptest.NewRecorder()
	searchRequest := httptest.NewRequest(http.MethodGet, "/api/v1/admin/sources/mock-mihon/search?q=neon", nil)
	searchRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(searchRecorder, searchRequest)
	if searchRecorder.Code != http.StatusConflict {
		t.Fatalf("expected disabled source search 409, got %d body=%s", searchRecorder.Code, searchRecorder.Body.String())
	}
}

func TestAdminDynamicJSONHTTPExtensionLifecycle(t *testing.T) {
	firstSource := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/healthz":
			w.WriteHeader(http.StatusOK)
		case "/search":
			writeJSON(w, http.StatusOK, map[string]any{"results": []map[string]any{{"id": "first-id", "title": "First Dynamic"}}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer firstSource.Close()
	secondSource := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/healthz":
			w.WriteHeader(http.StatusOK)
		case "/search":
			writeJSON(w, http.StatusOK, map[string]any{"results": []map[string]any{{"id": "second-id", "title": "Second Dynamic"}}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer secondSource.Close()

	handler := NewHandler(catalog.NewRepository(seed.Series()), WithAdminToken("dev-token")).Routes()

	createBody := `{"id":"dynamic-http","name":"Dynamic HTTP","kind":"json-http","baseUrl":"` + firstSource.URL + `","enabled":true}`
	createRecorder := httptest.NewRecorder()
	createRequest := httptest.NewRequest(http.MethodPost, "/api/v1/admin/extensions", bytes.NewBufferString(createBody))
	createRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(createRecorder, createRequest)
	if createRecorder.Code != http.StatusCreated {
		t.Fatalf("expected extension create 201, got %d body=%s", createRecorder.Code, createRecorder.Body.String())
	}

	statusRecorder := httptest.NewRecorder()
	statusRequest := httptest.NewRequest(http.MethodGet, "/api/v1/admin/extensions/dynamic-http/status", nil)
	statusRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(statusRecorder, statusRequest)
	if statusRecorder.Code != http.StatusOK {
		t.Fatalf("expected dynamic status 200, got %d body=%s", statusRecorder.Code, statusRecorder.Body.String())
	}

	searchRecorder := httptest.NewRecorder()
	searchRequest := httptest.NewRequest(http.MethodGet, "/api/v1/admin/sources/dynamic-http/search?q=x", nil)
	searchRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(searchRecorder, searchRequest)
	if searchRecorder.Code != http.StatusOK || !bytes.Contains(searchRecorder.Body.Bytes(), []byte("first-id")) {
		t.Fatalf("expected first source search 200, got %d body=%s", searchRecorder.Code, searchRecorder.Body.String())
	}

	patchRecorder := httptest.NewRecorder()
	patchRequest := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/extensions/dynamic-http", bytes.NewBufferString(`{"name":"Dynamic HTTP 2","baseUrl":"`+secondSource.URL+`"}`))
	patchRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(patchRecorder, patchRequest)
	if patchRecorder.Code != http.StatusOK {
		t.Fatalf("expected extension patch 200, got %d body=%s", patchRecorder.Code, patchRecorder.Body.String())
	}

	secondSearchRecorder := httptest.NewRecorder()
	secondSearchRequest := httptest.NewRequest(http.MethodGet, "/api/v1/admin/sources/dynamic-http/search?q=x", nil)
	secondSearchRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(secondSearchRecorder, secondSearchRequest)
	if secondSearchRecorder.Code != http.StatusOK || !bytes.Contains(secondSearchRecorder.Body.Bytes(), []byte("second-id")) {
		t.Fatalf("expected re-registered source search 200, got %d body=%s", secondSearchRecorder.Code, secondSearchRecorder.Body.String())
	}

	disableRecorder := httptest.NewRecorder()
	disableRequest := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/extensions/dynamic-http", bytes.NewBufferString(`{"enabled":false}`))
	disableRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(disableRecorder, disableRequest)
	if disableRecorder.Code != http.StatusOK {
		t.Fatalf("expected disable 200, got %d body=%s", disableRecorder.Code, disableRecorder.Body.String())
	}

	disabledSearchRecorder := httptest.NewRecorder()
	disabledSearchRequest := httptest.NewRequest(http.MethodGet, "/api/v1/admin/sources/dynamic-http/search?q=x", nil)
	disabledSearchRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(disabledSearchRecorder, disabledSearchRequest)
	if disabledSearchRecorder.Code != http.StatusConflict {
		t.Fatalf("expected disabled search 409, got %d body=%s", disabledSearchRecorder.Code, disabledSearchRecorder.Body.String())
	}

	deleteRecorder := httptest.NewRecorder()
	deleteRequest := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/extensions/dynamic-http", nil)
	deleteRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(deleteRecorder, deleteRequest)
	if deleteRecorder.Code != http.StatusOK {
		t.Fatalf("expected delete 200, got %d body=%s", deleteRecorder.Code, deleteRecorder.Body.String())
	}

	deletedStatusRecorder := httptest.NewRecorder()
	deletedStatusRequest := httptest.NewRequest(http.MethodGet, "/api/v1/admin/extensions/dynamic-http/status", nil)
	deletedStatusRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(deletedStatusRecorder, deletedStatusRequest)
	if deletedStatusRecorder.Code != http.StatusNotFound {
		t.Fatalf("expected deleted status 404, got %d body=%s", deletedStatusRecorder.Code, deletedStatusRecorder.Body.String())
	}
}

func TestAdminSyncSourceRejectsDisabledExtension(t *testing.T) {
	repo := catalog.NewRepository(seed.Series())
	_, err := repo.UpsertSourceExtension(context.Background(), types.SourceExtensionInput{
		ID:           "mock-mihon",
		Name:         "Mock Mihon Source",
		Kind:         "mock",
		Enabled:      false,
		Capabilities: []string{"search", "detail", "import", "pages"},
		Config:       map[string]any{},
	})
	if err != nil {
		t.Fatalf("seed extension: %v", err)
	}
	_, err = repo.UpsertSeries(context.Background(), types.SeriesInput{
		Slug:           "linked-disabled-source",
		Title:          "Linked Disabled Source",
		Type:           types.SeriesTypeComic,
		Status:         types.SeriesStatusOngoing,
		ContentRating:  types.ContentRatingTeen,
		Demographic:    types.DemographicGeneral,
		ReleaseYear:    2026,
		SourceID:       "mock-mihon",
		SourceSeriesID: "neon-rain",
	})
	if err != nil {
		t.Fatalf("seed linked series: %v", err)
	}
	handler := NewHandler(repo, WithAdminToken("dev-token")).Routes()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/admin/series/linked-disabled-source/sync-source", bytes.NewBufferString(`{"metadataOnly":true}`))
	request.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusConflict {
		t.Fatalf("expected disabled sync 409, got %d body=%s", recorder.Code, recorder.Body.String())
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
	syncRequest := httptest.NewRequest(http.MethodPost, "/api/v1/admin/series/neon-rain-protocol/sync-source", bytes.NewBufferString(`{"metadataOnly":true,"cachePages":true}`))
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

	var syncCreateResponse struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(syncRecorder.Body.Bytes(), &syncCreateResponse); err != nil {
		t.Fatalf("decode sync job create response: %v", err)
	}
	syncDetailRecorder := httptest.NewRecorder()
	syncDetailRequest := httptest.NewRequest(http.MethodGet, "/api/v1/admin/jobs/"+syncCreateResponse.Data.ID, nil)
	syncDetailRequest.Header.Set("Authorization", "Bearer dev-token")
	handler.ServeHTTP(syncDetailRecorder, syncDetailRequest)
	if syncDetailRecorder.Code != http.StatusOK {
		t.Fatalf("expected sync job detail 200, got %d body=%s", syncDetailRecorder.Code, syncDetailRecorder.Body.String())
	}
	var syncDetail struct {
		Data struct {
			Payload map[string]any `json:"payload"`
		} `json:"data"`
	}
	if err := json.NewDecoder(syncDetailRecorder.Body).Decode(&syncDetail); err != nil {
		t.Fatalf("decode sync job detail: %v", err)
	}
	if syncDetail.Data.Payload["metadataOnly"] != true || syncDetail.Data.Payload["cachePages"] != false {
		t.Fatalf("expected normalized sync payload, got %#v", syncDetail.Data.Payload)
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
