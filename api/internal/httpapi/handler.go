package httpapi

import (
	"archive/zip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"gomic-api/internal/catalog"
	"gomic-api/internal/imagecache"
	"gomic-api/internal/jobs"
	"gomic-api/internal/source"
	"gomic-api/internal/sourceimport"
	"gomic-api/internal/types"
)

type Handler struct {
	repo         catalog.Store
	adminRepo    catalog.AdminStore
	adminToken   string
	uploadDir    string
	imageHeaders map[string]string
	sources      *source.Registry
	jobs         jobs.Store
}

type envelope struct {
	Data  any `json:"data"`
	Meta  any `json:"meta"`
	Error any `json:"error"`
}

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func NewHandler(repo catalog.Store, options ...Option) *Handler {
	h := &Handler{repo: repo, uploadDir: "./uploads", sources: source.NewRegistry(source.NewMockSource()), jobs: jobs.NewStore()}
	if adminRepo, ok := repo.(catalog.AdminStore); ok {
		h.adminRepo = adminRepo
	}
	for _, option := range options {
		option(h)
	}
	return h
}

type Option func(*Handler)

func WithAdminToken(token string) Option {
	return func(h *Handler) {
		h.adminToken = token
	}
}

func WithUploadDir(dir string) Option {
	return func(h *Handler) {
		if dir != "" {
			h.uploadDir = dir
		}
	}
}

func WithSourceRegistry(registry *source.Registry) Option {
	return func(h *Handler) {
		if registry != nil {
			h.sources = registry
		}
	}
}

func WithImageHeaders(headers map[string]string) Option {
	return func(h *Handler) {
		h.imageHeaders = headers
	}
}

func WithJobStore(store jobs.Store) Option {
	return func(h *Handler) {
		if store != nil {
			h.jobs = store
		}
	}
}

func (h *Handler) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", h.health)
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(h.uploadDir))))
	mux.HandleFunc("GET /api/v1/genres", h.genres)
	mux.HandleFunc("GET /api/v1/series", h.seriesList)
	mux.HandleFunc("GET /api/v1/series/{slug}", h.seriesDetail)
	mux.HandleFunc("GET /api/v1/series/{slug}/chapters/{chapterSlug}", h.chapterReader)
	mux.HandleFunc("POST /api/v1/admin/login", h.adminLogin)
	mux.HandleFunc("GET /api/v1/admin/jobs", h.requireAdmin(h.adminJobsList))
	mux.HandleFunc("GET /api/v1/admin/jobs/{jobID}", h.requireAdmin(h.adminJobDetail))
	mux.HandleFunc("GET /api/v1/admin/series", h.requireAdmin(h.adminSeriesList))
	mux.HandleFunc("POST /api/v1/admin/series", h.requireAdmin(h.adminSeriesUpsert))
	mux.HandleFunc("GET /api/v1/admin/sources", h.requireAdmin(h.adminSourcesList))
	mux.HandleFunc("GET /api/v1/admin/sources/{sourceID}/search", h.requireAdmin(h.adminSourceSearch))
	mux.HandleFunc("GET /api/v1/admin/sources/{sourceID}/series/{seriesID}", h.requireAdmin(h.adminSourceDetail))
	mux.HandleFunc("POST /api/v1/admin/sources/{sourceID}/import", h.requireAdmin(h.adminSourceImport))
	mux.HandleFunc("POST /api/v1/admin/sources/{sourceID}/sync", h.requireAdmin(h.adminSourceImport))
	mux.HandleFunc("POST /api/v1/admin/series/{slug}/sync-source", h.requireAdmin(h.adminSeriesSyncSource))
	mux.HandleFunc("POST /api/v1/admin/series/{slug}/chapters", h.requireAdmin(h.adminChapterUpsert))
	mux.HandleFunc("PUT /api/v1/admin/series/{slug}/chapters/{chapterSlug}/pages", h.requireAdmin(h.adminChapterPagesReplace))
	mux.HandleFunc("POST /api/v1/admin/series/{slug}/chapters/{chapterSlug}/import-cbz", h.requireAdmin(h.adminChapterImportCBZ))
	return withCORS(mux)
}

func (h *Handler) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "gomic-api"})
}

func (h *Handler) genres(w http.ResponseWriter, r *http.Request) {
	genres, err := h.repo.Genres(r.Context())
	if err != nil {
		writeRepoError(w, err)
		return
	}
	writeEnvelope(w, http.StatusOK, genres, map[string]any{})
}

func (h *Handler) seriesList(w http.ResponseWriter, r *http.Request) {
	query := parseCatalogQuery(r)
	items, total, err := h.repo.List(r.Context(), query)
	if err != nil {
		writeRepoError(w, err)
		return
	}
	limit, offset := catalog.NormalizePagination(query)
	writeEnvelope(w, http.StatusOK, items, map[string]any{"total": total, "limit": limit, "offset": offset})
}

func (h *Handler) seriesDetail(w http.ResponseWriter, r *http.Request) {
	series, ok, err := h.repo.Detail(r.Context(), r.PathValue("slug"))
	if err != nil {
		writeRepoError(w, err)
		return
	}
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "series not found")
		return
	}
	writeEnvelope(w, http.StatusOK, series, map[string]any{})
}

func (h *Handler) chapterReader(w http.ResponseWriter, r *http.Request) {
	reader, ok, err := h.repo.Chapter(r.Context(), r.PathValue("slug"), r.PathValue("chapterSlug"))
	if err != nil {
		writeRepoError(w, err)
		return
	}
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "chapter not found")
		return
	}
	writeEnvelope(w, http.StatusOK, reader, map[string]any{})
}

func (h *Handler) adminLogin(w http.ResponseWriter, r *http.Request) {
	if h.adminToken == "" {
		writeError(w, http.StatusServiceUnavailable, "admin_disabled", "admin token is not configured")
		return
	}
	var input types.AdminLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if input.Token != h.adminToken {
		writeError(w, http.StatusUnauthorized, "unauthorized", "invalid admin token")
		return
	}
	writeEnvelope(w, http.StatusOK, types.AdminLoginResponse{Token: h.adminToken}, map[string]any{})
}

func (h *Handler) adminSeriesList(w http.ResponseWriter, r *http.Request) {
	if h.adminRepo == nil {
		writeError(w, http.StatusServiceUnavailable, "admin_unavailable", "admin repository is not available")
		return
	}
	query := parseCatalogQuery(r)
	items, total, err := h.adminRepo.ListAdminSeries(r.Context(), query)
	if err != nil {
		writeRepoError(w, err)
		return
	}
	limit, offset := catalog.NormalizePagination(query)
	writeEnvelope(w, http.StatusOK, items, map[string]any{"total": total, "limit": limit, "offset": offset})
}

func (h *Handler) adminSeriesUpsert(w http.ResponseWriter, r *http.Request) {
	if h.adminRepo == nil {
		writeError(w, http.StatusServiceUnavailable, "admin_unavailable", "admin repository is not available")
		return
	}
	var input types.SeriesInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	series, err := h.adminRepo.UpsertSeries(r.Context(), input)
	if errors.Is(err, catalog.ErrInvalidSeriesInput) {
		writeError(w, http.StatusBadRequest, "bad_request", "series slug, title, and release year are invalid")
		return
	}
	if err != nil {
		writeRepoError(w, err)
		return
	}
	writeEnvelope(w, http.StatusOK, series, map[string]any{})
}

func (h *Handler) adminSourcesList(w http.ResponseWriter, r *http.Request) {
	writeEnvelope(w, http.StatusOK, h.sources.List(), map[string]any{})
}

func (h *Handler) adminSourceSearch(w http.ResponseWriter, r *http.Request) {
	item, ok := h.sources.Get(r.PathValue("sourceID"))
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "source not found")
		return
	}
	results, err := item.Search(r.Context(), r.URL.Query().Get("q"))
	if err != nil {
		writeRepoError(w, err)
		return
	}
	writeEnvelope(w, http.StatusOK, results, map[string]any{"total": len(results)})
}

func (h *Handler) adminSourceDetail(w http.ResponseWriter, r *http.Request) {
	item, ok := h.sources.Get(r.PathValue("sourceID"))
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "source not found")
		return
	}
	detail, err := item.Detail(r.Context(), r.PathValue("seriesID"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", err.Error())
		return
	}
	writeEnvelope(w, http.StatusOK, detail, map[string]any{})
}

func (h *Handler) adminJobsList(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := h.jobs.List(r.Context(), limit)
	if err != nil {
		writeRepoError(w, err)
		return
	}
	writeEnvelope(w, http.StatusOK, items, map[string]any{"total": len(items)})
}

func (h *Handler) adminJobDetail(w http.ResponseWriter, r *http.Request) {
	job, ok, err := h.jobs.Get(r.Context(), r.PathValue("jobID"))
	if err != nil {
		writeRepoError(w, err)
		return
	}
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "job not found")
		return
	}
	writeEnvelope(w, http.StatusOK, job, map[string]any{})
}

func (h *Handler) adminSourceImport(w http.ResponseWriter, r *http.Request) {
	if h.adminRepo == nil {
		writeError(w, http.StatusServiceUnavailable, "admin_unavailable", "admin repository is not available")
		return
	}
	if _, ok := h.sources.Get(r.PathValue("sourceID")); !ok {
		writeError(w, http.StatusNotFound, "not_found", "source not found")
		return
	}
	var input struct {
		ID           string `json:"id"`
		ChapterLimit int    `json:"chapterLimit"`
		MetadataOnly bool   `json:"metadataOnly"`
		CachePages   *bool  `json:"cachePages"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if input.ChapterLimit < 0 {
		writeError(w, http.StatusBadRequest, "bad_request", "chapterLimit must be zero or greater")
		return
	}
	options := sourceimport.DefaultImportOptions()
	options.ChapterLimit = input.ChapterLimit
	if input.MetadataOnly {
		options.FetchPages = false
		options.CachePages = false
	}
	if input.CachePages != nil {
		options.CachePages = *input.CachePages
	}
	payload := map[string]any{"sourceId": r.PathValue("sourceID"), "sourceSeriesId": input.ID}
	if options.ChapterLimit > 0 {
		payload["chapterLimit"] = options.ChapterLimit
	}
	if input.MetadataOnly {
		payload["metadataOnly"] = true
	}
	if input.CachePages != nil {
		payload["cachePages"] = options.CachePages
	}
	job, err := h.jobs.Create(r.Context(), "source_import", "Queued source import", payload)
	if err != nil {
		writeRepoError(w, err)
		return
	}
	go h.runSourceJob(job.ID, func(ctx context.Context, report sourceimport.ProgressFunc) (sourceimport.Result, error) {
		return h.sourceImporter().ImportWithOptions(ctx, r.PathValue("sourceID"), input.ID, options, report)
	})
	writeEnvelope(w, http.StatusAccepted, job, map[string]any{})
}

func (h *Handler) adminSeriesSyncSource(w http.ResponseWriter, r *http.Request) {
	if h.adminRepo == nil {
		writeError(w, http.StatusServiceUnavailable, "admin_unavailable", "admin repository is not available")
		return
	}
	job, err := h.jobs.Create(r.Context(), "source_sync", "Queued source sync", map[string]any{"slug": r.PathValue("slug")})
	if err != nil {
		writeRepoError(w, err)
		return
	}
	go h.runSourceJob(job.ID, func(ctx context.Context, report sourceimport.ProgressFunc) (sourceimport.Result, error) {
		return h.sourceImporter().SyncSeriesWithProgress(ctx, r.PathValue("slug"), report)
	})
	writeEnvelope(w, http.StatusAccepted, job, map[string]any{})
}

func (h *Handler) sourceImporter() *sourceimport.Service {
	return sourceimport.New(h.repo, h.adminRepo, h.sources, imagecache.NewWithHeaders(h.uploadDir, h.imageHeaders))
}

func (h *Handler) runSourceJob(jobID string, run func(context.Context, sourceimport.ProgressFunc) (sourceimport.Result, error)) {
	_, _, _ = h.jobs.Update(context.Background(), jobID, jobs.StatusRunning, 10, "Running source task")
	report := func(progress sourceimport.Progress) {
		_, _, _ = h.jobs.Update(context.Background(), jobID, jobs.StatusRunning, progress.Progress, progress.Message)
	}
	result, err := run(context.Background(), report)
	if errors.Is(err, sourceimport.ErrSourceNotFound) || errors.Is(err, sourceimport.ErrSeriesNotFound) || errors.Is(err, sourceimport.ErrSeriesNotLinked) {
		_, _, _ = h.jobs.Update(context.Background(), jobID, jobs.StatusFailed, 100, err.Error())
		return
	}
	if err != nil {
		_, _, _ = h.jobs.Update(context.Background(), jobID, jobs.StatusFailed, 100, err.Error())
		return
	}
	_, _, _ = h.jobs.Update(context.Background(), jobID, jobs.StatusCompleted, 100, fmt.Sprintf("Imported %d chapters for %s", result.ChaptersImported, result.Series.Slug))
}

func (h *Handler) adminChapterUpsert(w http.ResponseWriter, r *http.Request) {
	if h.adminRepo == nil {
		writeError(w, http.StatusServiceUnavailable, "admin_unavailable", "admin repository is not available")
		return
	}
	var input types.ChapterInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	chapter, err := h.adminRepo.UpsertChapter(r.Context(), r.PathValue("slug"), input)
	if errors.Is(err, catalog.ErrInvalidChapterInput) {
		writeError(w, http.StatusBadRequest, "bad_request", "chapter slug and number label are required")
		return
	}
	if errors.Is(err, catalog.ErrSeriesNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "series not found")
		return
	}
	if err != nil {
		writeRepoError(w, err)
		return
	}
	writeEnvelope(w, http.StatusOK, chapter, map[string]any{})
}

func (h *Handler) adminChapterPagesReplace(w http.ResponseWriter, r *http.Request) {
	if h.adminRepo == nil {
		writeError(w, http.StatusServiceUnavailable, "admin_unavailable", "admin repository is not available")
		return
	}
	var input types.ChapterPagesInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	reader, err := h.adminRepo.ReplaceChapterPages(r.Context(), r.PathValue("slug"), r.PathValue("chapterSlug"), input.Pages)
	if errors.Is(err, catalog.ErrInvalidPagesInput) {
		writeError(w, http.StatusBadRequest, "bad_request", "pages require unique positive page numbers and image urls")
		return
	}
	if errors.Is(err, catalog.ErrSeriesNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "series not found")
		return
	}
	if errors.Is(err, catalog.ErrChapterNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "chapter not found")
		return
	}
	if err != nil {
		writeRepoError(w, err)
		return
	}
	writeEnvelope(w, http.StatusOK, reader, map[string]any{})
}

func (h *Handler) adminChapterImportCBZ(w http.ResponseWriter, r *http.Request) {
	if h.adminRepo == nil {
		writeError(w, http.StatusServiceUnavailable, "admin_unavailable", "admin repository is not available")
		return
	}
	if err := r.ParseMultipartForm(64 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid multipart form")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "cbz file is required")
		return
	}
	defer file.Close()
	if !strings.HasSuffix(strings.ToLower(header.Filename), ".cbz") && !strings.HasSuffix(strings.ToLower(header.Filename), ".zip") {
		writeError(w, http.StatusBadRequest, "bad_request", "file must be .cbz or .zip")
		return
	}

	tmpFile, err := os.CreateTemp("", "gomic-import-*.cbz")
	if err != nil {
		writeRepoError(w, err)
		return
	}
	defer os.Remove(tmpFile.Name())
	if _, err := io.Copy(tmpFile, file); err != nil {
		tmpFile.Close()
		writeRepoError(w, err)
		return
	}
	if err := tmpFile.Close(); err != nil {
		writeRepoError(w, err)
		return
	}

	pages, err := h.extractCBZPages(tmpFile.Name(), r.PathValue("slug"), r.PathValue("chapterSlug"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	reader, err := h.adminRepo.ReplaceChapterPages(r.Context(), r.PathValue("slug"), r.PathValue("chapterSlug"), pages)
	if errors.Is(err, catalog.ErrSeriesNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "series not found")
		return
	}
	if errors.Is(err, catalog.ErrChapterNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "chapter not found")
		return
	}
	if errors.Is(err, catalog.ErrInvalidPagesInput) {
		writeError(w, http.StatusBadRequest, "bad_request", "cbz produced invalid pages")
		return
	}
	if err != nil {
		writeRepoError(w, err)
		return
	}
	writeEnvelope(w, http.StatusOK, reader, map[string]any{"importedPages": len(pages)})
}

func (h *Handler) extractCBZPages(filename, seriesSlug, chapterSlug string) ([]types.ChapterPage, error) {
	reader, err := zip.OpenReader(filename)
	if err != nil {
		return nil, fmt.Errorf("invalid cbz archive")
	}
	defer reader.Close()

	files := make([]*zip.File, 0)
	for _, item := range reader.File {
		if item.FileInfo().IsDir() || !isImportImage(item.Name) {
			continue
		}
		files = append(files, item)
	}
	if len(files) == 0 {
		return nil, fmt.Errorf("cbz archive does not contain supported images")
	}
	sort.SliceStable(files, func(i, j int) bool { return files[i].Name < files[j].Name })

	targetDir := filepath.Join(h.uploadDir, "chapters", safePathPart(seriesSlug), safePathPart(chapterSlug))
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return nil, err
	}

	pages := make([]types.ChapterPage, 0, len(files))
	for index, item := range files {
		source, err := item.Open()
		if err != nil {
			return nil, err
		}
		ext := strings.ToLower(filepath.Ext(item.Name))
		pageNumber := index + 1
		diskName := fmt.Sprintf("%04d%s", pageNumber, ext)
		destinationPath := filepath.Join(targetDir, diskName)
		destination, err := os.Create(destinationPath)
		if err != nil {
			source.Close()
			return nil, err
		}
		_, copyErr := io.Copy(destination, source)
		closeErr := destination.Close()
		source.Close()
		if copyErr != nil {
			return nil, copyErr
		}
		if closeErr != nil {
			return nil, closeErr
		}
		pages = append(pages, types.ChapterPage{PageNumber: pageNumber, ImageURL: path.Join("/uploads/chapters", safePathPart(seriesSlug), safePathPart(chapterSlug), diskName)})
	}
	return pages, nil
}

func isImportImage(name string) bool {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
		return true
	default:
		return false
	}
}

func safePathPart(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	for _, char := range value {
		if (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char == '-' || char == '_' {
			builder.WriteRune(char)
		}
	}
	if builder.Len() == 0 {
		return "item"
	}
	return builder.String()
}

func (h *Handler) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if h.adminToken == "" {
			writeError(w, http.StatusServiceUnavailable, "admin_disabled", "admin token is not configured")
			return
		}
		if r.Header.Get("Authorization") != "Bearer "+h.adminToken {
			writeError(w, http.StatusUnauthorized, "unauthorized", "admin authorization required")
			return
		}
		next(w, r)
	}
}

func parseCatalogQuery(r *http.Request) catalog.Query {
	urlQuery := r.URL.Query()
	limit, _ := strconv.Atoi(urlQuery.Get("limit"))
	offset, _ := strconv.Atoi(urlQuery.Get("offset"))
	return catalog.Query{
		Search:      urlQuery.Get("q"),
		Genre:       urlQuery.Get("genre"),
		Type:        urlQuery.Get("type"),
		Status:      urlQuery.Get("status"),
		Demographic: urlQuery.Get("demographic"),
		Rating:      urlQuery.Get("rating"),
		Sort:        urlQuery.Get("sort"),
		Limit:       limit,
		Offset:      offset,
	}
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && (strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "http://127.0.0.1:")) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeRepoError(w http.ResponseWriter, err error) {
	if errors.Is(err, context.Canceled) {
		writeError(w, http.StatusBadRequest, "request_aborted", "request was aborted")
		return
	}
	slog.Error("repository error", "error", err)
	writeError(w, http.StatusInternalServerError, "internal_error", "internal server error")
}

func writeEnvelope(w http.ResponseWriter, status int, data any, meta any) {
	writeJSON(w, status, envelope{Data: data, Meta: meta, Error: nil})
}

func writeError(w http.ResponseWriter, status int, code string, message string) {
	writeJSON(w, status, envelope{Data: nil, Meta: map[string]any{}, Error: apiError{Code: code, Message: message}})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
