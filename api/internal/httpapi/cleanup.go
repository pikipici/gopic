package httpapi

import (
	"context"
	"log/slog"
	"time"

	"gomic-api/internal/imagecache"
	"gomic-api/internal/jobs"
)

type CleanupOptions struct {
	Interval     time.Duration
	JobRetention time.Duration
	CacheTTL     time.Duration
}

func StartCleanupLoop(ctx context.Context, store jobs.Store, cache *imagecache.Cache, opts CleanupOptions) {
	if opts.Interval <= 0 {
		return
	}
	ticker := time.NewTicker(opts.Interval)
	go func() {
		defer ticker.Stop()
		for {
			runCleanup(ctx, store, cache, opts)
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
}

func runCleanup(ctx context.Context, store jobs.Store, cache *imagecache.Cache, opts CleanupOptions) {
	if store != nil && opts.JobRetention > 0 {
		removed, err := store.Prune(ctx, opts.JobRetention)
		if err != nil {
			slog.Warn("prune jobs", "error", err)
		} else if removed > 0 {
			slog.Info("pruned admin jobs", "count", removed)
		}
	}
	if cache != nil && opts.CacheTTL > 0 {
		removed, err := cache.Prune(opts.CacheTTL)
		if err != nil {
			slog.Warn("prune image cache", "error", err)
		} else if removed > 0 {
			slog.Info("pruned cached images", "count", removed)
		}
	}
}
