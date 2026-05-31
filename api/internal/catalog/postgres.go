package catalog

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"gomic-api/internal/types"
)

type PostgresRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

func (r *PostgresRepository) List(ctx context.Context, query Query) ([]types.SeriesSummary, int, error) {
	limit, offset := NormalizePagination(query)
	where, args := buildSeriesWhere(query)
	countSQL := "SELECT count(*) FROM series s " + where

	var total int
	if err := r.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	orderBy := "s.updated_at::text DESC"
	switch query.Sort {
	case "title":
		orderBy = "s.title ASC"
	case "chapters":
		orderBy = "chapter_count DESC, s.updated_at::text DESC"
	case "year":
		orderBy = "s.release_year DESC, s.updated_at::text DESC"
	}

	args = append(args, limit, offset)
	listSQL := fmt.Sprintf(`
SELECT
  s.slug,
  s.title,
  s.alt_titles,
  s.synopsis,
  s.cover_url,
  s.type,
  s.status,
  s.content_rating,
  s.demographic,
  s.author_name,
  s.artist_name,
  s.release_year,
  COALESCE(array_agg(DISTINCT g.name) FILTER (WHERE g.name IS NOT NULL), '{}') AS genres,
  count(DISTINCT c.id) AS chapter_count,
  lc.slug,
  lc.number_label,
  lc.number_sort,
  lc.title,
  lc.published_at::text,
  COALESCE(lc.page_count, 0) AS latest_page_count,
  s.featured,
  s.updated_at::text,
  s.source_id,
  s.source_series_id,
  s.source_url,
  s.last_synced_at::text
FROM series s
LEFT JOIN series_genres sg ON sg.series_id = s.id
LEFT JOIN genres g ON g.id = sg.genre_id
LEFT JOIN chapters c ON c.series_id = s.id AND c.publish_state = 'published'
LEFT JOIN LATERAL (
  SELECT ch.slug, ch.number_label, ch.number_sort, ch.title, ch.published_at, count(cp.id) AS page_count
  FROM chapters ch
  LEFT JOIN chapter_pages cp ON cp.chapter_id = ch.id
  WHERE ch.series_id = s.id AND ch.publish_state = 'published'
  GROUP BY ch.id
  ORDER BY ch.number_sort DESC
  LIMIT 1
) lc ON TRUE
%s
GROUP BY s.id, lc.slug, lc.number_label, lc.number_sort, lc.title, lc.published_at::text, lc.page_count
ORDER BY %s
LIMIT $%d OFFSET $%d`, where, orderBy, len(args)-1, len(args))

	rows, err := r.pool.Query(ctx, listSQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := []types.SeriesSummary{}
	for rows.Next() {
		series, err := scanSeriesSummary(rows.Scan)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, series)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *PostgresRepository) Detail(ctx context.Context, slug string) (types.SeriesDetail, bool, error) {
	rows, err := r.pool.Query(ctx, `
SELECT
  s.slug,
  s.title,
  s.alt_titles,
  s.synopsis,
  s.cover_url,
  s.type,
  s.status,
  s.content_rating,
  s.demographic,
  s.author_name,
  s.artist_name,
  s.release_year,
  COALESCE(array_agg(DISTINCT g.name) FILTER (WHERE g.name IS NOT NULL), '{}') AS genres,
  count(DISTINCT c.id) AS chapter_count,
  lc.slug,
  lc.number_label,
  lc.number_sort,
  lc.title,
  lc.published_at::text,
  COALESCE(lc.page_count, 0) AS latest_page_count,
  s.featured,
  s.updated_at::text,
  s.source_id,
  s.source_series_id,
  s.source_url,
  s.last_synced_at::text
FROM series s
LEFT JOIN series_genres sg ON sg.series_id = s.id
LEFT JOIN genres g ON g.id = sg.genre_id
LEFT JOIN chapters c ON c.series_id = s.id AND c.publish_state = 'published'
LEFT JOIN LATERAL (
  SELECT ch.slug, ch.number_label, ch.number_sort, ch.title, ch.published_at, count(cp.id) AS page_count
  FROM chapters ch
  LEFT JOIN chapter_pages cp ON cp.chapter_id = ch.id
  WHERE ch.series_id = s.id AND ch.publish_state = 'published'
  GROUP BY ch.id
  ORDER BY ch.number_sort DESC
  LIMIT 1
) lc ON TRUE
WHERE s.publish_state = 'published' AND s.slug = $1
GROUP BY s.id, lc.slug, lc.number_label, lc.number_sort, lc.title, lc.published_at::text, lc.page_count`, slug)
	if err != nil {
		return types.SeriesDetail{}, false, err
	}
	defer rows.Close()
	if !rows.Next() {
		return types.SeriesDetail{}, false, rows.Err()
	}
	summary, err := scanSeriesSummary(rows.Scan)
	if err != nil {
		return types.SeriesDetail{}, false, err
	}

	chapters, err := r.chapters(ctx, slug)
	if err != nil {
		return types.SeriesDetail{}, false, err
	}
	return types.SeriesDetail{SeriesSummary: summary, Chapters: chapters}, true, nil
}

func (r *PostgresRepository) Chapter(ctx context.Context, seriesSlug, chapterSlug string) (types.ChapterReader, bool, error) {
	var reader types.ChapterReader
	var chapter types.Chapter
	var publishedAt sql.NullString
	err := r.pool.QueryRow(ctx, `
SELECT s.slug, s.title, c.slug, c.number_label, c.number_sort, c.title, c.published_at::text
FROM series s
JOIN chapters c ON c.series_id = s.id
WHERE s.publish_state = 'published' AND c.publish_state = 'published' AND s.slug = $1 AND c.slug = $2`, seriesSlug, chapterSlug).Scan(
		&reader.Series.Slug,
		&reader.Series.Title,
		&chapter.Slug,
		&chapter.NumberLabel,
		&chapter.NumberSort,
		&chapter.Title,
		&publishedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return types.ChapterReader{}, false, nil
		}
		return types.ChapterReader{}, false, err
	}
	chapter.PublishedAt = publishedAt.String

	pages, err := r.pages(ctx, seriesSlug, chapterSlug)
	if err != nil {
		return types.ChapterReader{}, false, err
	}
	chapter.Pages = pages
	reader.Chapter = chapter
	return reader, true, nil
}

func (r *PostgresRepository) Genres(ctx context.Context) ([]string, error) {
	rows, err := r.pool.Query(ctx, `
SELECT DISTINCT g.name
FROM genres g
JOIN series_genres sg ON sg.genre_id = g.id
JOIN series s ON s.id = sg.series_id
WHERE s.publish_state = 'published'
ORDER BY g.name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	genres := []string{}
	for rows.Next() {
		var genre string
		if err := rows.Scan(&genre); err != nil {
			return nil, err
		}
		genres = append(genres, genre)
	}
	return genres, rows.Err()
}

func (r *PostgresRepository) ListAdminSeries(ctx context.Context, query Query) ([]types.SeriesSummary, int, error) {
	return r.List(ctx, query)
}

func (r *PostgresRepository) UpsertSeries(ctx context.Context, input types.SeriesInput) (types.SeriesDetail, error) {
	if err := validateSeriesInput(input); err != nil {
		return types.SeriesDetail{}, err
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return types.SeriesDetail{}, err
	}
	defer tx.Rollback(ctx)

	var seriesID string
	err = tx.QueryRow(ctx, `
INSERT INTO series (slug, title, alt_titles, synopsis, cover_url, type, status, content_rating, demographic, author_name, artist_name, release_year, featured, publish_state, updated_at, published_at, source_id, source_series_id, source_url, last_synced_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'published', now(), COALESCE(now(), now()), $14, $15, $16, CASE WHEN $14 <> '' AND $15 <> '' THEN now() ELSE NULL END)
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
  source_id = CASE WHEN EXCLUDED.source_id <> '' THEN EXCLUDED.source_id ELSE series.source_id END,
  source_series_id = CASE WHEN EXCLUDED.source_series_id <> '' THEN EXCLUDED.source_series_id ELSE series.source_series_id END,
  source_url = CASE WHEN EXCLUDED.source_url <> '' THEN EXCLUDED.source_url ELSE series.source_url END,
  last_synced_at = CASE WHEN EXCLUDED.source_id <> '' AND EXCLUDED.source_series_id <> '' THEN now() ELSE series.last_synced_at END,
  publish_state = 'published',
  updated_at = now(),
  published_at = COALESCE(series.published_at, EXCLUDED.published_at)
RETURNING id`, input.Slug, input.Title, input.AltTitles, input.Synopsis, input.CoverURL, input.Type, input.Status, input.ContentRating, input.Demographic, input.AuthorName, input.ArtistName, input.ReleaseYear, input.Featured, input.SourceID, input.SourceSeriesID, input.SourceURL).Scan(&seriesID)
	if err != nil {
		return types.SeriesDetail{}, err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM series_genres WHERE series_id = $1`, seriesID); err != nil {
		return types.SeriesDetail{}, err
	}
	for _, genre := range input.Genres {
		name := strings.TrimSpace(genre)
		if name == "" {
			continue
		}
		var genreID string
		if err := tx.QueryRow(ctx, `
INSERT INTO genres (slug, name)
VALUES ($1, $2)
ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug
RETURNING id`, slugifyGenre(name), name).Scan(&genreID); err != nil {
			return types.SeriesDetail{}, err
		}
		if _, err := tx.Exec(ctx, `
INSERT INTO series_genres (series_id, genre_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING`, seriesID, genreID); err != nil {
			return types.SeriesDetail{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return types.SeriesDetail{}, err
	}
	detail, ok, err := r.Detail(ctx, input.Slug)
	if err != nil {
		return types.SeriesDetail{}, err
	}
	if !ok {
		return types.SeriesDetail{}, pgx.ErrNoRows
	}
	return detail, nil
}

func (r *PostgresRepository) UpsertChapter(ctx context.Context, seriesSlug string, input types.ChapterInput) (types.ChapterSummary, error) {
	if err := validateChapterInput(input); err != nil {
		return types.ChapterSummary{}, err
	}
	var seriesID string
	if err := r.pool.QueryRow(ctx, `SELECT id FROM series WHERE slug = $1`, seriesSlug).Scan(&seriesID); err != nil {
		if err == pgx.ErrNoRows {
			return types.ChapterSummary{}, ErrSeriesNotFound
		}
		return types.ChapterSummary{}, err
	}

	publishedAt := normalizePublishedAt(input.PublishedAt)
	var chapter types.ChapterSummary
	err := r.pool.QueryRow(ctx, `
INSERT INTO chapters (series_id, slug, number_label, number_sort, title, publish_state, updated_at, published_at, source_chapter_id)
VALUES ($1, $2, $3, $4, $5, 'published', now(), $6, $7)
ON CONFLICT (series_id, slug) DO UPDATE SET
  number_label = EXCLUDED.number_label,
  number_sort = EXCLUDED.number_sort,
  title = EXCLUDED.title,
  source_chapter_id = CASE WHEN EXCLUDED.source_chapter_id <> '' THEN EXCLUDED.source_chapter_id ELSE chapters.source_chapter_id END,
  publish_state = 'published',
  updated_at = now(),
  published_at = EXCLUDED.published_at
RETURNING slug, number_label, number_sort, title, published_at::text`, seriesID, input.Slug, input.NumberLabel, input.NumberSort, input.Title, publishedAt, input.SourceChapterID).Scan(
		&chapter.Slug,
		&chapter.NumberLabel,
		&chapter.NumberSort,
		&chapter.Title,
		&chapter.PublishedAt,
	)
	if err != nil {
		return types.ChapterSummary{}, err
	}
	return chapter, nil
}

func (r *PostgresRepository) ReplaceChapterPages(ctx context.Context, seriesSlug, chapterSlug string, pages []types.ChapterPage) (types.ChapterReader, error) {
	if err := validatePagesInput(pages); err != nil {
		return types.ChapterReader{}, err
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return types.ChapterReader{}, err
	}
	defer tx.Rollback(ctx)

	var chapterID string
	err = tx.QueryRow(ctx, `
SELECT c.id
FROM chapters c
JOIN series s ON s.id = c.series_id
WHERE s.slug = $1 AND c.slug = $2`, seriesSlug, chapterSlug).Scan(&chapterID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return types.ChapterReader{}, ErrChapterNotFound
		}
		return types.ChapterReader{}, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM chapter_pages WHERE chapter_id = $1`, chapterID); err != nil {
		return types.ChapterReader{}, err
	}
	for _, page := range normalizePages(pages) {
		if _, err := tx.Exec(ctx, `
INSERT INTO chapter_pages (chapter_id, page_number, image_url, width, height)
VALUES ($1, $2, $3, $4, $5)`, chapterID, page.PageNumber, page.ImageURL, page.Width, page.Height); err != nil {
			return types.ChapterReader{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return types.ChapterReader{}, err
	}
	reader, ok, err := r.Chapter(ctx, seriesSlug, chapterSlug)
	if err != nil {
		return types.ChapterReader{}, err
	}
	if !ok {
		return types.ChapterReader{}, ErrChapterNotFound
	}
	return reader, nil
}

func (r *PostgresRepository) chapters(ctx context.Context, seriesSlug string) ([]types.ChapterSummary, error) {
	rows, err := r.pool.Query(ctx, `
SELECT c.slug, c.number_label, c.number_sort, c.title, c.published_at::text, count(cp.id) AS page_count
FROM series s
JOIN chapters c ON c.series_id = s.id
LEFT JOIN chapter_pages cp ON cp.chapter_id = c.id
WHERE s.publish_state = 'published' AND c.publish_state = 'published' AND s.slug = $1
GROUP BY c.id
ORDER BY c.number_sort DESC`, seriesSlug)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	chapters := []types.ChapterSummary{}
	for rows.Next() {
		var chapter types.ChapterSummary
		var publishedAt sql.NullString
		if err := rows.Scan(&chapter.Slug, &chapter.NumberLabel, &chapter.NumberSort, &chapter.Title, &publishedAt, &chapter.PageCount); err != nil {
			return nil, err
		}
		chapter.PublishedAt = publishedAt.String
		chapters = append(chapters, chapter)
	}
	return chapters, rows.Err()
}

func (r *PostgresRepository) pages(ctx context.Context, seriesSlug, chapterSlug string) ([]types.ChapterPage, error) {
	rows, err := r.pool.Query(ctx, `
SELECT cp.page_number, cp.image_url, COALESCE(cp.width, 0), COALESCE(cp.height, 0)
FROM series s
JOIN chapters c ON c.series_id = s.id
JOIN chapter_pages cp ON cp.chapter_id = c.id
WHERE s.publish_state = 'published' AND c.publish_state = 'published' AND s.slug = $1 AND c.slug = $2
ORDER BY cp.page_number ASC`, seriesSlug, chapterSlug)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pages := []types.ChapterPage{}
	for rows.Next() {
		var page types.ChapterPage
		if err := rows.Scan(&page.PageNumber, &page.ImageURL, &page.Width, &page.Height); err != nil {
			return nil, err
		}
		pages = append(pages, page)
	}
	return pages, rows.Err()
}

type scanFunc func(dest ...any) error

func scanSeriesSummary(scan scanFunc) (types.SeriesSummary, error) {
	var series types.SeriesSummary
	var latestSlug sql.NullString
	var latestLabel sql.NullString
	var latestNumber sql.NullFloat64
	var latestTitle sql.NullString
	var latestPublishedAt sql.NullString
	var latestPageCount int
	var updatedAt sql.NullString
	var sourceID sql.NullString
	var sourceSeriesID sql.NullString
	var sourceURL sql.NullString
	var lastSyncedAt sql.NullString

	err := scan(
		&series.Slug,
		&series.Title,
		&series.AltTitles,
		&series.Synopsis,
		&series.CoverURL,
		&series.Type,
		&series.Status,
		&series.ContentRating,
		&series.Demographic,
		&series.AuthorName,
		&series.ArtistName,
		&series.ReleaseYear,
		&series.Genres,
		&series.ChapterCount,
		&latestSlug,
		&latestLabel,
		&latestNumber,
		&latestTitle,
		&latestPublishedAt,
		&latestPageCount,
		&series.Featured,
		&updatedAt,
		&sourceID,
		&sourceSeriesID,
		&sourceURL,
		&lastSyncedAt,
	)
	if err != nil {
		return types.SeriesSummary{}, err
	}
	series.UpdatedAt = updatedAt.String
	series.SourceID = sourceID.String
	series.SourceSeriesID = sourceSeriesID.String
	series.SourceURL = sourceURL.String
	series.LastSyncedAt = lastSyncedAt.String
	if latestSlug.Valid {
		series.LatestChapter = &types.ChapterSummary{
			Slug:        latestSlug.String,
			NumberLabel: latestLabel.String,
			NumberSort:  latestNumber.Float64,
			Title:       latestTitle.String,
			PublishedAt: latestPublishedAt.String,
			PageCount:   latestPageCount,
		}
	}
	return series, nil
}

func buildSeriesWhere(query Query) (string, []any) {
	clauses := []string{"s.publish_state = 'published'"}
	args := []any{}
	add := func(clause string, value any) {
		args = append(args, value)
		clauses = append(clauses, fmt.Sprintf(clause, len(args)))
	}
	if strings.TrimSpace(query.Search) != "" {
		args = append(args, strings.TrimSpace(query.Search))
		placeholder := fmt.Sprintf("$%d", len(args))
		clauses = append(clauses, "(s.title ILIKE '%' || "+placeholder+" || '%' OR array_to_string(s.alt_titles, ' ') ILIKE '%' || "+placeholder+" || '%' OR s.synopsis ILIKE '%' || "+placeholder+" || '%' OR s.author_name ILIKE '%' || "+placeholder+" || '%' OR s.artist_name ILIKE '%' || "+placeholder+" || '%')")
	}
	if query.Genre != "" {
		add("EXISTS (SELECT 1 FROM series_genres sg2 JOIN genres g2 ON g2.id = sg2.genre_id WHERE sg2.series_id = s.id AND g2.name = $%d)", query.Genre)
	}
	if query.Type != "" {
		add("s.type = $%d", query.Type)
	}
	if query.Status != "" {
		add("s.status = $%d", query.Status)
	}
	if query.Demographic != "" {
		add("s.demographic = $%d", query.Demographic)
	}
	if query.Rating != "" {
		add("s.content_rating = $%d", query.Rating)
	}
	return "WHERE " + strings.Join(clauses, " AND "), args
}
