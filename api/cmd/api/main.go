package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"gomic-api/internal/catalog"
	"gomic-api/internal/config"
	"gomic-api/internal/httpapi"
	"gomic-api/internal/imagecache"
	"gomic-api/internal/jobs"
	"gomic-api/internal/seed"
	"gomic-api/internal/source"
	"gomic-api/internal/types"
)

func sourceIndex(idx int) string {
	return strconv.Itoa(idx + 1)
}

func main() {
	cfg := config.Load()
	ctx := context.Background()

	repo := catalog.Store(catalog.NewRepository(seed.Series()))
	jobStore := jobs.Store(jobs.NewStore())
	if !cfg.UseSeed {
		pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
		if err != nil {
			slog.Error("connect postgres", "error", err)
			os.Exit(1)
		}
		defer pool.Close()

		pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		if err := pool.Ping(pingCtx); err != nil {
			slog.Error("ping postgres", "error", err)
			os.Exit(1)
		}
		repo = catalog.NewPostgresRepository(pool)
		jobStore = jobs.NewPostgresStore(pool)
		if err := jobs.RecoverRunning(ctx, jobStore); err != nil {
			slog.Error("recover interrupted jobs", "error", err)
			os.Exit(1)
		}
		slog.Info("using postgres catalog repository")
	} else {
		slog.Info("using seed catalog repository")
	}

	registeredSources := []source.Source{source.NewMockSource()}
	sourceExtensionInputs := []types.SourceExtensionInput{{
		ID:           "mock-mihon",
		Name:         "Mock Mihon Source",
		Kind:         "mock",
		Enabled:      true,
		Capabilities: []string{"search", "detail", "import", "pages"},
		Config:       map[string]any{},
	}}
	for idx, sourceConfig := range cfg.Sources {
		sourceID := sourceConfig.ID
		if sourceID == "" {
			sourceID = "json-http"
			if len(cfg.Sources) > 1 {
				sourceID = "json-http-" + sourceIndex(idx)
			}
		}
		sourceName := sourceConfig.Name
		if sourceName == "" {
			sourceName = "JSON HTTP Source"
		}
		headers := sourceConfig.Headers
		if headers == nil && sourceConfig.URL == cfg.SourceURL {
			headers = cfg.SourceHeaders
		}
		registeredSources = append(registeredSources, source.NewJSONHTTPSourceWithHeaders(sourceID, sourceName, sourceConfig.URL, headers))
		sourceExtensionInputs = append(sourceExtensionInputs, types.SourceExtensionInput{
			ID:           sourceID,
			Name:         sourceName,
			Kind:         "json-http",
			BaseURL:      sourceConfig.URL,
			Enabled:      true,
			Capabilities: []string{"search", "detail", "import", "pages"},
			Config:       map[string]any{},
		})
		slog.Info("registered json http source", "id", sourceID, "url", sourceConfig.URL)
	}
	sourceRegistry := source.NewRegistry(registeredSources...)
	if adminStore, ok := repo.(catalog.AdminStore); ok {
		for _, input := range sourceExtensionInputs {
			if _, err := adminStore.UpsertSourceExtension(ctx, input); err != nil {
				slog.Error("sync source extension", "id", input.ID, "error", err)
				os.Exit(1)
			}
		}
	}

	handler := httpapi.NewHandler(repo, httpapi.WithAdminToken(cfg.AdminToken), httpapi.WithUploadDir(cfg.UploadDir), httpapi.WithJobStore(jobStore), httpapi.WithSourceRegistry(sourceRegistry), httpapi.WithImageHeaders(cfg.ImageHeaders))

	httpapi.StartCleanupLoop(ctx, jobStore, imagecache.NewWithHeaders(cfg.UploadDir, cfg.ImageHeaders), httpapi.CleanupOptions{
		Interval:     cfg.CleanupInterval,
		JobRetention: cfg.JobRetention,
		CacheTTL:     cfg.CacheTTL,
	})

	slog.Info("starting gomic api", "addr", cfg.Addr)
	if err := http.ListenAndServe(cfg.Addr, handler.Routes()); err != nil {
		slog.Error("server stopped", "error", err)
		os.Exit(1)
	}
}
