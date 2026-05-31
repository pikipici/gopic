# Gomic JSON HTTP Source Service Contract

Gomic can import external catalog data through a small HTTP JSON service. The API registers that service when `SOURCE_URL` is set.

```bash
SOURCE_ID=local-json
SOURCE_NAME="Local JSON Source"
SOURCE_URL=http://localhost:19090
SOURCE_HEADERS='User-Agent: GomicBot/1.0|Referer: https://source.example/'
IMAGE_HEADERS='User-Agent: GomicBot/1.0|Referer: https://source.example/'
```

The source service is called by the Go API, not by the browser. All endpoints must return JSON and a 2xx status for success.

## Endpoints

### `GET /search?q=<query>`

Returns lightweight search results.

```json
{
  "results": [
    {
      "id": "sample-series",
      "title": "Sample Series",
      "url": "https://source.example/series/sample-series",
      "coverUrl": "https://source.example/covers/sample-series.jpg"
    }
  ]
}
```

Fields:

- `id`: stable external source ID. Used again in detail/import/page requests.
- `title`: display title.
- `url`: original source URL for operator reference.
- `coverUrl`: image URL. Can be remote `http(s)` or local path if the API/web can access it.

`sourceId` may be omitted. Gomic overwrites it with configured `SOURCE_ID`.

### `GET /series/{id}`

Returns preview metadata for the admin UI.

```json
{
  "id": "sample-series",
  "title": "Sample Series",
  "url": "https://source.example/series/sample-series",
  "coverUrl": "https://source.example/covers/sample-series.jpg",
  "synopsis": "Short preview synopsis.",
  "type": "manhwa",
  "status": "ongoing",
  "authorName": "Source Author",
  "artistName": "Source Artist",
  "releaseYear": 2026,
  "genres": ["Action", "Mystery"],
  "chapterCount": 2,
  "chapters": [
    {
      "id": "sample-001",
      "slug": "chapter-001",
      "numberLabel": "Chapter 1",
      "numberSort": 1,
      "title": "First Signal",
      "publishedAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

Accepted enum values:

- `type`: `manga`, `manhwa`, `manhua`, `comic`
- `status`: `ongoing`, `completed`, `hiatus`

### `GET /series/{id}/import`

Returns full import metadata. Gomic upserts the series and chapters from this response.

```json
{
  "series": {
    "slug": "sample-series",
    "title": "Sample Series",
    "altTitles": ["Sample Alt"],
    "synopsis": "Full synopsis.",
    "coverUrl": "https://source.example/covers/sample-series.jpg",
    "type": "manhwa",
    "status": "ongoing",
    "contentRating": "teen",
    "demographic": "general",
    "authorName": "Source Author",
    "artistName": "Source Artist",
    "releaseYear": 2026,
    "genres": ["Action", "Mystery"],
    "featured": false,
    "sourceSeriesId": "sample-series",
    "sourceUrl": "https://source.example/series/sample-series"
  },
  "chapters": [
    {
      "slug": "chapter-001",
      "numberLabel": "Chapter 1",
      "numberSort": 1,
      "title": "First Signal",
      "publishedAt": "2026-01-01T00:00:00Z",
      "sourceChapterId": "sample-001"
    }
  ]
}
```

Accepted enum values:

- `contentRating`: `all`, `teen`, `mature`
- `demographic`: `shounen`, `shoujo`, `seinen`, `josei`, `general`

Notes:

- `sourceSeriesId` can be omitted; Gomic fills it with `{id}`.
- `sourceUrl` can be omitted; Gomic fills it with `SOURCE_URL + /series/{id}`.
- Chapter `slug` must be stable because Gomic requests pages by chapter slug.
- Gomic currently stores imported series as draft/public according to API repository defaults; source service does not set publish state.

### `GET /series/{id}/chapters/{chapterSlug}/pages`

Returns pages for one chapter. Gomic calls this during import/sync.

```json
{
  "pages": [
    {
      "pageNumber": 1,
      "imageUrl": "https://source.example/pages/sample-001-001.jpg",
      "width": 900,
      "height": 1280
    }
  ]
}
```

Notes:

- `imageUrl` can be remote `http(s)` or local `/path`.
- Remote images are fetched and cached by the API image cache.
- `IMAGE_HEADERS` are sent when Gomic fetches remote page images.
- Local/non-http image URLs are left as-is.

## Error Semantics

Use normal HTTP status codes:

- `404`: series/chapter not found.
- `429`: rate-limited by upstream source.
- `500`: scraper/source failure.

Gomic treats any non-2xx response as a failed import/sync job.

## Local Sample

Run the full automated smoke test:

```bash
bash tools/smoke_json_source.sh
```

Or run the included sample source service manually:

```bash
python tools/source_service_mock.py --port 19090
```

For a parser-oriented real-source scaffold, see `docs/source-scraper-scaffold.md` and `tools/source_service_scraper.py`.

Then run the API with:

```bash
SOURCE_ID=sample-json \
SOURCE_NAME="Sample JSON Source" \
SOURCE_URL=http://localhost:19090 \
DATABASE_URL='postgres://gomic:gomic_dev_password@localhost:5432/gomic?sslmode=disable' \
ADDR=:18090 \
ADMIN_TOKEN=dev-token \
go run ./cmd/api
```

The admin UI will show both `mock-mihon` and `Sample JSON Source`.
