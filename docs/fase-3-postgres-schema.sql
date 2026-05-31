-- Fase 3 PostgreSQL schema draft for Gomic.
-- Uses UUID primary keys and slug-based public lookup.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE series_type AS ENUM ('manga', 'manhwa', 'manhua', 'comic');
CREATE TYPE series_status AS ENUM ('ongoing', 'completed', 'hiatus');
CREATE TYPE content_rating AS ENUM ('all', 'teen', 'mature');
CREATE TYPE demographic AS ENUM ('shounen', 'shoujo', 'seinen', 'josei', 'general');
CREATE TYPE publish_state AS ENUM ('draft', 'published', 'archived');

CREATE TABLE series (
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
  published_at TIMESTAMPTZ
);

CREATE TABLE genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE series_genres (
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  genre_id UUID NOT NULL REFERENCES genres(id) ON DELETE RESTRICT,
  PRIMARY KEY (series_id, genre_id)
);

CREATE TABLE chapters (
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
  UNIQUE (series_id, slug),
  UNIQUE (series_id, number_sort)
);

CREATE TABLE chapter_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  image_url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, page_number)
);

CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_series_public ON series (publish_state, updated_at DESC);
CREATE INDEX idx_series_slug_public ON series (slug) WHERE publish_state = 'published';
CREATE INDEX idx_chapters_public ON chapters (series_id, publish_state, number_sort DESC);
CREATE INDEX idx_chapter_pages_order ON chapter_pages (chapter_id, page_number ASC);
CREATE INDEX idx_series_genres_genre ON series_genres (genre_id, series_id);

-- Search index option for later:
-- CREATE INDEX idx_series_search ON series USING GIN (
--   to_tsvector('simple', title || ' ' || array_to_string(alt_titles, ' ') || ' ' || synopsis || ' ' || author_name || ' ' || artist_name)
-- );
