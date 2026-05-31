# Local Development

This is the quick local workflow for the DB-backed Gomic admin/import flow.

## 1. Start PostgreSQL

From the project root:

```bash
docker compose up -d postgres
```

Check it is healthy:

```bash
docker inspect -f '{{.State.Health.Status}}' gomic-postgres
```

## 2. Run The API

From `api/`:

```bash
export DATABASE_URL='postgres://gomic:gomic_dev_password@localhost:5432/gomic?sslmode=disable'
export ADDR=':18090'
export ADMIN_TOKEN='dev-token'
export UPLOAD_DIR='./uploads'
go run ./cmd/migrate
go run ./cmd/api
```

Useful API env lives in `api/.env.example`.

Seed-only API mode is still available:

```bash
GOMIC_USE_SEED=1 ADMIN_TOKEN=dev-token go run ./cmd/api
```

## 3. Run The Web App

From `web/`:

```bash
export NEXT_PUBLIC_API_BASE_URL='http://localhost:18090'
npm run dev -- --port 13000
```

`npm run dev` uses `next dev --webpack` intentionally. On this Windows/Git Bash setup, the default Next 16 dev mode has repeatedly hung with `EPIPE: broken pipe, write` during admin/reader navigation. If you want to test Turbopack anyway, use:

```bash
npm run dev:turbo -- --port 13000
```

Open:

```text
http://localhost:13000/admin
```

Admin token:

```text
dev-token
```

## 4. Smoke Test Admin Mihon Bridge

From the project root, with Docker/Postgres running:

```bash
bash tools/smoke_admin_mihon.sh
```

The smoke test validates:

- PostgreSQL migration applies cleanly.
- API starts against the real DB.
- Admin source list/search works.
- `mock-mihon` import job completes.
- Series, chapters, pages, and jobs persist in PostgreSQL.
- Sync job completes.
- Cleanup loop prunes finished jobs after the short smoke retention window.

Useful overrides:

```bash
API_PORT=18090 ADMIN_TOKEN=dev-token bash tools/smoke_admin_mihon.sh
KEEP_RUNNING=1 bash tools/smoke_admin_mihon.sh
```

## 5. JSON HTTP Source Service

The contract for plugging in a real scraper/source bridge is documented in `docs/source-service-contract.md`.

Run the automated JSON source smoke test:

```bash
bash tools/smoke_json_source.sh
```

It starts `tools/source_service_mock.py`, starts a temporary API on `:18100` with `SOURCE_URL`, validates search/preview/import/sync against PostgreSQL, then shuts both processes down.

For manual testing, run the sample source service:

```bash
python tools/source_service_mock.py --port 19090
```

Run the API with that source registered:

```bash
SOURCE_ID=sample-json \
SOURCE_NAME="Sample JSON Source" \
SOURCE_URL=http://localhost:19090 \
DATABASE_URL='postgres://gomic:gomic_dev_password@localhost:5432/gomic?sslmode=disable' \
ADDR=:18090 \
ADMIN_TOKEN=dev-token \
go run ./cmd/api
```

The admin source selector will show both `mock-mihon` and `Sample JSON Source`.

For parser work against a real target, start from `tools/source_service_scraper.py` and follow `docs/source-scraper-scaffold.md`.

## 6. Manual Admin Test Flow

1. Open `http://localhost:13000/admin`.
2. Login with `dev-token`.
3. Search source query `neon` for `mock-mihon`, or `json` for `Sample JSON Source`.
4. Preview the result.
5. Import it and wait until the job is `completed`.
6. Open the imported series detail page, for example `http://localhost:13000/series/neon-rain-protocol`.
7. Open chapter `chapter-001`.
8. Run sync source from admin and confirm the job completes.

## Troubleshooting

If the web page says it is rendering forever:

```bash
netstat -ano | grep ':13000'
```

Find the `node.exe` listener PID, kill it, clear dev cache, and restart in webpack mode:

```bash
taskkill //F //PID <pid>
rm -rf web/.next/dev
cd web
NEXT_PUBLIC_API_BASE_URL=http://localhost:18090 npm run dev -- --port 13000
```

If API-backed pages cannot find imported content, check the API directly:

```bash
curl http://localhost:18090/api/v1/series/neon-rain-protocol
curl http://localhost:18090/api/v1/series/neon-rain-protocol/chapters/chapter-001
```
