package main

import (
	"context"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"gomic-api/internal/seed"
	"gomic-api/internal/types"
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

	for _, series := range seed.Series() {
		if err := upsertSeries(ctx, pool, series); err != nil {
			slog.Error("seed series", "slug", series.Slug, "error", err)
			os.Exit(1)
		}
	}
	slog.Info("seed data imported", "series", len(seed.Series()))
}

func upsertSeries(ctx context.Context, pool *pgxpool.Pool, series types.Series) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var seriesID string
	err = tx.QueryRow(ctx, `
INSERT INTO series (slug, title, alt_titles, synopsis, cover_url, type, status, content_rating, demographic, author_name, artist_name, release_year, featured, publish_state, updated_at, published_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'published', $14, $14)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  alt_titles = EXCLUDED.alt_titles,
  synopsis = EXCLUDED.synopsis,
  cover_url = EXCLUDED.cover_url,
  type = EXCLUDED.type,
  status = EXCLUDED.status,
  content_rating = EXCLUDED.content_rating,
  demographic = EXCLUDED.demographic,
  author_name = EXCLUDED.author_name,
  artist_name = EXCLUDED.artist_name,
  release_year = EXCLUDED.release_year,
  featured = EXCLUDED.featured,
  publish_state = 'published',
  updated_at = EXCLUDED.updated_at,
  published_at = COALESCE(series.published_at, EXCLUDED.published_at)
RETURNING id`, series.Slug, series.Title, series.AltTitles, series.Synopsis, series.CoverURL, series.Type, series.Status, series.ContentRating, series.Demographic, series.AuthorName, series.ArtistName, series.ReleaseYear, series.Featured, series.UpdatedAt).Scan(&seriesID)
	if err != nil {
		return err
	}

	for _, genre := range series.Genres {
		var genreID string
		slug := strings.ToLower(strings.ReplaceAll(genre, " ", "-"))
		if err := tx.QueryRow(ctx, `
INSERT INTO genres (slug, name)
VALUES ($1, $2)
ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug
RETURNING id`, slug, genre).Scan(&genreID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
INSERT INTO series_genres (series_id, genre_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING`, seriesID, genreID); err != nil {
			return err
		}
	}

	for _, chapter := range series.Chapters {
		var chapterID string
		if err := tx.QueryRow(ctx, `
INSERT INTO chapters (series_id, slug, number_label, number_sort, title, publish_state, updated_at, published_at)
VALUES ($1, $2, $3, $4, $5, 'published', $6, $6)
ON CONFLICT (series_id, slug) DO UPDATE SET
  number_label = EXCLUDED.number_label,
  number_sort = EXCLUDED.number_sort,
  title = EXCLUDED.title,
  publish_state = 'published',
  updated_at = EXCLUDED.updated_at,
  published_at = EXCLUDED.published_at
RETURNING id`, seriesID, chapter.Slug, chapter.NumberLabel, chapter.NumberSort, chapter.Title, chapter.PublishedAt).Scan(&chapterID); err != nil {
			return err
		}
		for _, page := range chapter.Pages {
			if _, err := tx.Exec(ctx, `
INSERT INTO chapter_pages (chapter_id, page_number, image_url, width, height)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (chapter_id, page_number) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  width = EXCLUDED.width,
  height = EXCLUDED.height`, chapterID, page.PageNumber, page.ImageURL, page.Width, page.Height); err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}
