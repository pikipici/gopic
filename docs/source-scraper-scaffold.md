# Source Scraper Scaffold

`tools/source_service_scraper.py` is a safe starting point for a real source bridge. It exposes the same JSON HTTP source contract as `tools/source_service_mock.py`, but separates the parser seams from the HTTP server.

## Run Fixture Mode

Fixture mode is deterministic and does not call any external site:

```bash
python tools/source_service_scraper.py --port 19190 --mode fixture
```

Try it directly:

```bash
curl 'http://localhost:19190/search?q=fixture'
curl 'http://localhost:19190/series/fixture-scraper-series'
curl 'http://localhost:19190/series/fixture-scraper-series/import'
curl 'http://localhost:19190/series/fixture-scraper-series/chapters/chapter-001/pages'
```

Point Gomic API at it:

```bash
SOURCE_ID=fixture-scraper \
SOURCE_NAME="Fixture Scraper" \
SOURCE_URL=http://localhost:19190 \
DATABASE_URL='postgres://gomic:gomic_dev_password@localhost:5432/gomic?sslmode=disable' \
ADDR=:18090 \
ADMIN_TOKEN=dev-token \
go run ./cmd/api
```

## Komik Cast Mode

Komik Cast mode uses the public JSON API mirrored from the Mihon/Tachiyomi extension (`https://be.komikcast.cc`) and defaults the web base URL to `https://v2.komikcast.fit`:

```bash
SOURCE_USER_AGENT='Mozilla/5.0 GomicScraper/0.1' \
SOURCE_REQUEST_DELAY=0.5 \
python tools/source_service_scraper.py --port 19190 --mode komikcast
```

Try it directly:

```bash
curl 'http://localhost:19190/search?q=one%20piece'
curl 'http://localhost:19190/series/one-piece'
curl 'http://localhost:19190/series/one-piece/import'
curl 'http://localhost:19190/series/one-piece/chapters/1184/pages'
```

Point Gomic API at it:

```bash
SOURCE_ID=komikcast \
SOURCE_NAME="Komik Cast" \
SOURCE_URL=http://localhost:19190 \
DATABASE_URL='postgres://gomic:gomic_dev_password@localhost:5432/gomic?sslmode=disable' \
ADDR=:18090 \
ADMIN_TOKEN=dev-token \
go run ./cmd/api
```

Run the live smoke test with the lightweight `academy-of-card` series. The smoke uses `chapterLimit=2` by default so it only imports/caches the latest two chapters:

```bash
bash tools/smoke_komikcast_source.sh
```

Source import accepts optional controls for large series:

```json
{"id":"academy-of-card","chapterLimit":2}
{"id":"academy-of-card","metadataOnly":true}
{"id":"academy-of-card","cachePages":false}
```

Avoid full-importing very large series such as `one-piece` until the UI exposes these options clearly.

## KomikIndo Mode

KomikIndo mode uses the MangaThemesia/WordPress HTML layout and defaults the upstream base URL to `https://komikindo.fit`:

```bash
SOURCE_USER_AGENT='Mozilla/5.0 GomicScraper/0.1' \
SOURCE_REQUEST_DELAY=0.5 \
python tools/source_service_scraper.py --port 19190 --mode komikindo
```

Try it directly with a lightweight one-chapter series:

```bash
curl 'http://localhost:19190/search?q=one%20piece'
curl 'http://localhost:19190/series/dorobouneko-no-douzou-one-piece'
curl 'http://localhost:19190/series/dorobouneko-no-douzou-one-piece/import'
curl 'http://localhost:19190/series/dorobouneko-no-douzou-one-piece/chapters/dorobouneko-no-douzou-one-piece-bahasa-indonesia/pages'
```

Point Gomic API at it:

```bash
SOURCE_ID=komikindo \
SOURCE_NAME="KomikIndo" \
SOURCE_URL=http://localhost:19190 \
DATABASE_URL='postgres://gomic:gomic_dev_password@localhost:5432/gomic?sslmode=disable' \
ADDR=:18090 \
ADMIN_TOKEN=dev-token \
go run ./cmd/api
```

Run the live smoke test. The default series has one chapter, so the script uses `CHAPTER_LIMIT=1`:

```bash
bash tools/smoke_komikindo_source.sh
```

## Real Mode

Real mode starts the same HTTP service but returns `501` until parser methods are implemented:

```bash
SOURCE_BASE_URL=https://target.example \
SOURCE_USER_AGENT='Mozilla/5.0 GomicScraper/0.1' \
SOURCE_REFERER=https://target.example/ \
SOURCE_REQUEST_DELAY=1.0 \
python tools/source_service_scraper.py --port 19190 --mode real
```

Environment knobs:

- `SOURCE_BASE_URL`: upstream site base URL for relative fetches.
- `SOURCE_USER_AGENT`: header used for upstream HTML fetches.
- `SOURCE_REFERER`: optional upstream referer header.
- `SOURCE_REQUEST_DELAY`: seconds between upstream requests, default `0.5`.
- `SOURCE_TIMEOUT`: upstream request timeout, default `20`.

## Where To Implement A Target Source

Edit `tools/source_service_scraper.py`:

- `Scraper.search(query)`: fetch/search upstream and return `{ "results": [...] }`.
- `Scraper.detail(series_id)`: return preview metadata for one series.
- `Scraper.import_series(series_id)`: return full `series` + `chapters` import payload.
- `Scraper.pages(series_id, chapter_slug)`: return `{ "pages": [...] }`.
- `Scraper.fetch_text(path_or_url)`: already handles basic headers, timeout, and throttling.

Keep returned payloads aligned with `docs/source-service-contract.md`.

## Suggested Implementation Order

1. Implement `search()` with a saved HTML fixture or one live upstream request.
2. Implement `detail()` for a single known series ID.
3. Implement `import_series()` using the same detail/chapter parser.
4. Implement `pages()` for one known chapter.
5. Run the service locally and import through admin UI.
6. Add a smoke script for that specific target only after the parser is stable.

## Safety Notes

- Respect target source terms and robots/rate limits.
- Keep this scraper as a separate process from the Go API.
- Prefer cached fixtures while developing parsers.
- Do not put cookies/tokens in docs or committed files; pass them through environment variables if needed.
- If a source uses Cloudflare/browser challenges, do not hack around it inside the core app; isolate experiments in this service.
