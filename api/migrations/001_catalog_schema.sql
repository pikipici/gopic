-- Gomic catalog schema.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE series_type AS ENUM ('manga', 'manhwa', 'manhua', 'comic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE series_status AS ENUM ('ongoing', 'completed', 'hiatus');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE content_rating AS ENUM ('all', 'teen', 'mature');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE demographic AS ENUM ('shounen', 'shoujo', 'seinen', 'josei', 'general');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE publish_state AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  alt_titles TEXT[] NOT NULL DEFAULT '{}',
  synopsis TEXT NOT NULL DEFAULT '',
  cover_url TEXT NOT NULL DEFAULT '',
  type series_type NOT NULL,
  status series_status NOT NULL DEFAULT 'ongoing',
  content_rating content_rating NOT NULL DEFAULT 'teen',
  demographic demographic NOT NULL DEFAULT 'general',
  author_name TEXT NOT NULL DEFAULT '',
  artist_name TEXT NOT NULL DEFAULT '',
  release_year INTEGER NOT NULL CHECK (release_year >= 1900 AND release_year <= 2200),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  publish_state publish_state NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  source_id TEXT NOT NULL DEFAULT '',
  source_series_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  last_synced_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS series_genres (
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  genre_id UUID NOT NULL REFERENCES genres(id) ON DELETE RESTRICT,
  PRIMARY KEY (series_id, genre_id)
);

CREATE TABLE IF NOT EXISTS chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  number_label TEXT NOT NULL,
  number_sort NUMERIC(10, 3) NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  publish_state publish_state NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  source_chapter_id TEXT NOT NULL DEFAULT '',
  UNIQUE (series_id, slug),
  UNIQUE (series_id, number_sort)
);

ALTER TABLE series ADD COLUMN IF NOT EXISTS source_id TEXT NOT NULL DEFAULT '';
ALTER TABLE series ADD COLUMN IF NOT EXISTS source_series_id TEXT NOT NULL DEFAULT '';
ALTER TABLE series ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL DEFAULT '';
ALTER TABLE series ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS source_chapter_id TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS chapter_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  image_url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, page_number)
);

CREATE TABLE IF NOT EXISTS admin_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  message TEXT NOT NULL DEFAULT '',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS admin_source_extensions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'json-http',
  base_url TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  capabilities TEXT[] NOT NULL DEFAULT '{}',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_series_source_unique ON series (source_id, source_series_id) WHERE source_id <> '' AND source_series_id <> '';
CREATE INDEX IF NOT EXISTS idx_admin_jobs_updated ON admin_jobs (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_source_extensions_enabled ON admin_source_extensions (enabled, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_series_public ON series (publish_state, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_series_slug_public ON series (slug) WHERE publish_state = 'published';
CREATE INDEX IF NOT EXISTS idx_chapters_public ON chapters (series_id, publish_state, number_sort DESC);
CREATE INDEX IF NOT EXISTS idx_chapter_pages_order ON chapter_pages (chapter_id, page_number ASC);
CREATE INDEX IF NOT EXISTS idx_series_genres_genre ON series_genres (genre_id, series_id);
