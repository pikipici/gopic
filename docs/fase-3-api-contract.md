# Fase 3 API Contract Draft

Base path: `/api/v1`

## Principles
- Public catalog endpoints return published data only.
- Response shapes mirror frontend seed types so `web/src/lib/catalog.ts` can be replaced by an API client cleanly.
- Admin/auth/upload endpoints are planned but not implemented in first scaffold.
- Timestamps are RFC3339 strings.

## Standard response envelope

```json
{
  "data": {},
  "meta": {},
  "error": null
}
```

For errors:

```json
{
  "data": null,
  "meta": {},
  "error": {
    "code": "not_found",
    "message": "resource not found"
  }
}
```

## Public endpoints

### `GET /healthz`
Health endpoint outside versioned API for infra checks.

Response:
```json
{ "status": "ok", "service": "gomic-api" }
```

### `GET /api/v1/series`
List public series.

Query params:
- `q` string search title/alt title/synopsis/author/artist
- `genre` exact genre name
- `type` manga|manhwa|manhua|comic
- `status` ongoing|completed|hiatus
- `demographic` shounen|shoujo|seinen|josei|general
- `rating` all|teen|mature
- `sort` latest|title|chapters|year
- `limit` default 24, max 100
- `offset` default 0

Response `data`: array of `SeriesSummary`.
Response `meta`: `{ "total": 4, "limit": 24, "offset": 0 }`.

### `GET /api/v1/series/{slug}`
Return full series detail including chapters, no pages.

Response `data`: `SeriesDetail`.

### `GET /api/v1/series/{slug}/chapters/{chapterSlug}`
Return chapter reader payload including page URLs.

Response `data`: `ChapterReader`.

### `GET /api/v1/genres`
Return all public genres.

Response `data`: string array.

## Shapes

### `SeriesSummary`
```json
{
  "slug": "nighthawk-protocol",
  "title": "Nighthawk Protocol",
  "altTitles": ["Night Hawk"],
  "synopsis": "...",
  "coverUrl": "/mock-covers/nighthawk.svg",
  "type": "manhwa",
  "status": "ongoing",
  "contentRating": "teen",
  "demographic": "seinen",
  "authorName": "Raka Aster",
  "artistName": "Mira Void",
  "releaseYear": 2025,
  "genres": ["Action", "Cyberpunk"],
  "chapterCount": 3,
  "latestChapter": {
    "slug": "chapter-003",
    "numberLabel": "Chapter 3",
    "numberSort": 3,
    "title": "Packet Loss",
    "publishedAt": "2026-05-29T10:00:00Z"
  },
  "featured": true,
  "updatedAt": "2026-05-29T10:00:00Z"
}
```

### `SeriesDetail`
Same as `SeriesSummary`, plus:
```json
{
  "chapters": [
    {
      "slug": "chapter-003",
      "numberLabel": "Chapter 3",
      "numberSort": 3,
      "title": "Packet Loss",
      "publishedAt": "2026-05-29T10:00:00Z",
      "pageCount": 4
    }
  ]
}
```

### `ChapterReader`
```json
{
  "series": {
    "slug": "nighthawk-protocol",
    "title": "Nighthawk Protocol"
  },
  "chapter": {
    "slug": "chapter-003",
    "numberLabel": "Chapter 3",
    "numberSort": 3,
    "title": "Packet Loss",
    "publishedAt": "2026-05-29T10:00:00Z",
    "pages": [
      {
        "pageNumber": 1,
        "imageUrl": "/mock-pages/nighthawk-003-1.svg",
        "width": 900,
        "height": 1280
      }
    ]
  }
}
```

## Admin endpoints

Admin endpoints are scaffolded for local/dev content management. Set `ADMIN_TOKEN` and send `Authorization: Bearer <ADMIN_TOKEN>` for protected routes.

### `POST /api/v1/admin/login`
Validates a shared admin token.

Request:
```json
{ "token": "dev-token" }
```

Response `data`:
```json
{ "token": "dev-token" }
```

### `GET /api/v1/admin/series`
Protected. Lists series using the same query params as public catalog.

### `POST /api/v1/admin/series`
Protected. Creates or updates a series shell.

Request `SeriesInput`:
```json
{
  "slug": "sample-series",
  "title": "Sample Series",
  "altTitles": [],
  "synopsis": "...",
  "coverUrl": "/mock-covers/sample.svg",
  "type": "comic",
  "status": "ongoing",
  "contentRating": "teen",
  "demographic": "general",
  "authorName": "Admin",
  "artistName": "Admin",
  "releaseYear": 2026,
  "genres": ["Action"],
  "featured": false
}
```

### `POST /api/v1/admin/series/{slug}/chapters`
Protected. Creates or updates a published chapter for a series.

Request `ChapterInput`:
```json
{
  "slug": "chapter-004",
  "numberLabel": "Chapter 4",
  "numberSort": 4,
  "title": "Signal Bloom",
  "publishedAt": "2026-06-01T10:00:00Z"
}
```

### `PUT /api/v1/admin/series/{slug}/chapters/{chapterSlug}/pages`
Protected. Replaces all pages for a chapter. Pages are sorted by `pageNumber`.

Request:
```json
{
  "pages": [
    {
      "pageNumber": 1,
      "imageUrl": "/mock-pages/nighthawk-004-1.svg",
      "width": 900,
      "height": 1280
    }
  ]
}
```

## Planned admin endpoints later
- `PATCH /api/v1/admin/series/{id}`
- `PATCH /api/v1/admin/chapters/{id}`
- `PATCH /api/v1/admin/chapters/{id}/publish`
