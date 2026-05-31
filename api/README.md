# Gomic API

Fase 3 Go API scaffold. The API can run from in-memory seed data for local dev, or from PostgreSQL when `DATABASE_URL` is set.

## Run With Seed Data

```bash
go run ./cmd/api
```

Default address: `:8080`. Override with:

```bash
ADDR=:9090 go run ./cmd/api
```

Force seed mode even when `DATABASE_URL` exists:

```bash
GOMIC_USE_SEED=1 go run ./cmd/api
```

Enable local admin endpoints with a shared dev token:

```bash
ADMIN_TOKEN=dev-token go run ./cmd/api
```

## Run With PostgreSQL

From the project root, start the local dev database:

```bash
docker compose up -d postgres
```

Then from `api/`:

```bash
export DATABASE_URL='postgres://gomic:gomic_dev_password@localhost:5432/gomic?sslmode=disable'
go run ./cmd/migrate
go run ./cmd/seed
go run ./cmd/api
```

Notes:
- `cmd/migrate` applies SQL files from `migrations/*.sql` in filename order.
- `cmd/seed` imports the current Go seed catalog into PostgreSQL.
- If `DATABASE_URL` is unset, `cmd/api` falls back to seed repository automatically.
- Admin series, chapter, page create/update, CBZ page import, source import/sync jobs, and job cleanup are wired for both seed mode and PostgreSQL mode.
- `UPLOAD_DIR` controls local extracted page storage and source image cache; default is `./uploads`, served at `/uploads/*`.
- See `../docs/local-dev.md` for the full local web + API + smoke workflow.

## Admin Source Import Smoke

From the project root, after `docker compose up -d postgres`:

```bash
bash tools/smoke_admin_mihon.sh
```

This validates migration, source search, import job, DB persistence, sync job, and cleanup pruning against real PostgreSQL.

## JSON HTTP Source Bridge

Set `SOURCE_URL` to register an external JSON source service alongside `mock-mihon`:

```bash
SOURCE_ID=sample-json \
SOURCE_NAME="Sample JSON Source" \
SOURCE_URL=http://localhost:19090 \
go run ./cmd/api
```

See `../docs/source-service-contract.md` for the required endpoints and payload shapes. A runnable local sample lives at `../tools/source_service_mock.py`, and the automated smoke is `../tools/smoke_json_source.sh`.

To register multiple external JSON sources at once, set `SOURCES_JSON`:

```bash
SOURCES_JSON='[{"id":"komikcast","name":"Komik Cast","url":"http://localhost:19190"},{"id":"komikindo","name":"KomikIndo","url":"http://localhost:19191"}]' \
go run ./cmd/api
```

`SOURCE_ID` / `SOURCE_NAME` / `SOURCE_URL` still work for a single legacy source and can be combined with `SOURCES_JSON`.

For day-to-day local development, start the full multi-source stack from the repository root:

```bash
bash tools/dev_multisource.sh
```

It starts KomikCast on `19190`, KomikIndo on `19191`, the API on `18190`, and the web admin on `13000`, then prints the admin URL and token. Press `Ctrl+C` in that terminal to stop the stack.

## Source Import Options

Admin source imports accept safety options in the request body:

```bash
curl -X POST http://localhost:8080/api/v1/admin/sources/komikcast/import \
  -H 'Authorization: Bearer dev-token' \
  -H 'Content-Type: application/json' \
  -d '{"id":"academy-of-card","chapterLimit":2}'
```

Supported options:
- `chapterLimit`: imports only the latest N chapters. Use this for large series.
- `metadataOnly`: imports series and chapter metadata without fetching page lists or caching images.
- `cachePages`: when false, fetches page lists but stores upstream image URLs instead of caching locally.

Examples:

```json
{"id":"academy-of-card","chapterLimit":2}
{"id":"academy-of-card","metadataOnly":true}
{"id":"academy-of-card","chapterLimit":5,"cachePages":false}
```

For KomikCast live smoke testing, use `bash ../tools/smoke_komikcast_source.sh` from `api/` or `bash tools/smoke_komikcast_source.sh` from the project root. The script defaults to `academy-of-card` and `CHAPTER_LIMIT=2` to avoid accidentally importing very large series.

## Endpoints

- `GET /healthz`
- `GET /api/v1/genres`
- `GET /api/v1/series`
- `GET /api/v1/series?genre=Action&sort=chapters`
- `GET /api/v1/series/{slug}`
- `GET /api/v1/series/{slug}/chapters/{chapterSlug}`
- `POST /api/v1/admin/login`
- `GET /api/v1/admin/series`
- `POST /api/v1/admin/series`
- `POST /api/v1/admin/series/{slug}/chapters`
- `PUT /api/v1/admin/series/{slug}/chapters/{chapterSlug}/pages`
- `POST /api/v1/admin/series/{slug}/chapters/{chapterSlug}/import-cbz`
- `GET /api/v1/admin/sources`
- `GET /api/v1/admin/sources/{sourceID}/search?q=neon`
- `GET /api/v1/admin/sources/{sourceID}/series/{seriesID}`
- `POST /api/v1/admin/sources/{sourceID}/import`
- `POST /api/v1/admin/series/{slug}/sync-source`
- `GET /api/v1/admin/jobs?limit=12`
- `GET /api/v1/admin/jobs/{jobID}`

See `../docs/fase-3-api-contract.md` for full contract.
