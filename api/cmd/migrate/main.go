package main

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		slog.Error("DATABASE_URL is required")
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		slog.Error("connect postgres", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	files, err := filepath.Glob("migrations/*.sql")
	if err != nil {
		slog.Error("read migrations", "error", err)
		os.Exit(1)
	}
	sort.Strings(files)
	for _, file := range files {
		sqlBytes, err := os.ReadFile(file)
		if err != nil {
			slog.Error("read migration", "file", file, "error", err)
			os.Exit(1)
		}
		if _, err := pool.Exec(ctx, string(sqlBytes)); err != nil {
			slog.Error("run migration", "file", file, "error", err)
			os.Exit(1)
		}
		slog.Info("migration applied", "file", file)
	}
}
