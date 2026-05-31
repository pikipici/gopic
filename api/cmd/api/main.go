package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"gomic-api/internal/catalog"
	"gomic-api/internal/config"
	"gomic-api/internal/httpapi"
	"gomic-api/internal/imagecache"
	"gomic-api/internal/jobs"
	"gomic-api/internal/seed"
	"gomic-api/internal/source"
)

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

	sourceRegistry := source.NewRegistry(source.NewMockSource())
	if cfg.SourceURL != "" {
		sourceID := cfg.SourceID
		if sourceID == "" {
			sourceID = "json-http"
		}
		sourceName := cfg.SourceName
		if sourceName == "" {
			sourceName = "JSON HTTP Source"
		}
		sourceRegistry = source.NewRegistry(source.NewMockSource(), source.NewJSONHTTPSourceWithHeaders(sourceID, sourceName, cfg.SourceURL, cfg.SourceHeaders))
		slog.Info("registered json http source", "id", sourceID, "url", cfg.SourceURL)
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
