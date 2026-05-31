#!/usr/bin/env bash
# Smoke test the JSON HTTP source bridge using tools/source_service_mock.py.
#
# This validates that a SOURCE_URL-backed adapter can search, import, persist
# chapters/pages, and sync against the real PostgreSQL-backed Gomic API.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/api"
SOURCE_SERVICE="$ROOT_DIR/tools/source_service_mock.py"

API_PORT=${API_PORT:-18100}
SOURCE_PORT=${SOURCE_PORT:-19090}
ADMIN_TOKEN=${ADMIN_TOKEN:-dev-token}
PG_CONTAINER=${PG_CONTAINER:-gomic-postgres}
DB_USER=${DB_USER:-gomic}
DB_NAME=${DB_NAME:-gomic}
DB_DSN=${DB_DSN:-postgres://gomic:gomic_dev_password@localhost:5432/gomic?sslmode=disable}
SOURCE_ID=${SOURCE_ID:-sample-json}
SOURCE_NAME=${SOURCE_NAME:-Sample JSON Source}
SOURCE_SERIES_ID=${SOURCE_SERIES_ID:-sample-json-series}
IMPORTED_SLUG=${IMPORTED_SLUG:-sample-json-lantern}
API_BIN=${API_BIN:-/tmp/gomic-api-json-smoke}
UPLOAD_DIR=${UPLOAD_DIR:-/tmp/gomic-json-source-uploads}
PYTHON=${PYTHON:-python}
KEEP_RUNNING=${KEEP_RUNNING:-0}

BASE_URL="http://localhost:$API_PORT"
SOURCE_URL="http://localhost:$SOURCE_PORT"
AUTH_HEADER="Authorization: Bearer $ADMIN_TOKEN"
API_PID=""
SOURCE_PID=""

step() { printf "\n\033[1;36m== %s ==\033[0m\n" "$*"; }
ok()   { printf "  \033[1;32mok\033[0m %s\n" "$*"; }
fail() { printf "  \033[1;31mfail\033[0m %s\n" "$*" >&2; exit 1; }

json_get() {
  "$PYTHON" - "$1" "$2" <<'PYEOF'
import json, re, sys
data = json.loads(sys.argv[1])
for token in re.findall(r"[^.\[\]]+|\[\d+\]", sys.argv[2]):
    data = data[int(token[1:-1])] if token.startswith("[") else data[token]
sys.stdout.write("" if data is None else str(data))
PYEOF
}

cleanup() {
  if [ "$KEEP_RUNNING" = "1" ]; then
    return
  fi
  for pid in "$API_PID" "$SOURCE_PID"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT

step "preflight"
command -v docker >/dev/null || fail "docker not in PATH"
command -v curl >/dev/null || fail "curl not in PATH"
command -v "$PYTHON" >/dev/null || fail "$PYTHON not in PATH"
docker inspect "$PG_CONTAINER" >/dev/null 2>&1 || fail "postgres container '$PG_CONTAINER' not found. run: docker compose up -d postgres"
status=$(docker inspect -f '{{.State.Health.Status}}' "$PG_CONTAINER" 2>/dev/null || echo unknown)
[ "$status" = "healthy" ] || fail "postgres container '$PG_CONTAINER' status=$status (expected healthy)"
[ -f "$SOURCE_SERVICE" ] || fail "source service not found: $SOURCE_SERVICE"
ok "dependencies ready"

step "clean previous sample rows"
docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL >/dev/null
DELETE FROM series WHERE slug = '$IMPORTED_SLUG' OR source_series_id = '$SOURCE_SERIES_ID';
DELETE FROM admin_jobs WHERE payload->>'sourceId' = '$SOURCE_ID' OR payload->>'slug' = '$IMPORTED_SLUG';
SQL
rm -rf "$UPLOAD_DIR"
mkdir -p "$UPLOAD_DIR"
ok "sample rows/uploads cleared"

step "start sample source service"
"$PYTHON" "$SOURCE_SERVICE" --port "$SOURCE_PORT" >/tmp/gomic-json-source-service.log 2>&1 &
SOURCE_PID=$!
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "$SOURCE_URL/healthz" >/dev/null 2>&1; then break; fi
  sleep 0.5
  if [ "$i" = 10 ]; then tail /tmp/gomic-json-source-service.log >&2; fail "source service did not become healthy"; fi
done
ok "source service up at $SOURCE_URL"

step "build api"
( cd "$API_DIR" && go build -o "$API_BIN" ./cmd/api )
ok "binary at $API_BIN"

step "start api with SOURCE_URL"
DATABASE_URL="$DB_DSN" \
ADDR=":$API_PORT" \
ADMIN_TOKEN="$ADMIN_TOKEN" \
UPLOAD_DIR="$UPLOAD_DIR" \
SOURCE_ID="$SOURCE_ID" \
SOURCE_NAME="$SOURCE_NAME" \
SOURCE_URL="$SOURCE_URL" \
CLEANUP_INTERVAL=0 \
"$API_BIN" >/tmp/gomic-json-source-api.log 2>&1 &
API_PID=$!
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "$BASE_URL/healthz" >/dev/null 2>&1; then break; fi
  sleep 0.5
  if [ "$i" = 10 ]; then tail /tmp/gomic-json-source-api.log >&2; fail "api did not become healthy"; fi
done
ok "api up at $BASE_URL"

step "verify source registry"
sources=$(curl -sS -H "$AUTH_HEADER" "$BASE_URL/api/v1/admin/sources")
if ! "$PYTHON" - "$sources" "$SOURCE_ID" <<'PYEOF'
import json, sys
payload = json.loads(sys.argv[1])
source_id = sys.argv[2]
ids = {item["id"] for item in payload["data"]}
sys.exit(0 if source_id in ids and "mock-mihon" in ids else 1)
PYEOF
then
  fail "source registry missing expected ids: $sources"
fi
ok "registry contains mock-mihon and $SOURCE_ID"

step "search JSON source"
search=$(curl -sS -H "$AUTH_HEADER" "$BASE_URL/api/v1/admin/sources/$SOURCE_ID/search?q=json")
[ "$(json_get "$search" 'data[0].id')" = "$SOURCE_SERIES_ID" ] || fail "search failed: $search"
ok "search returned $SOURCE_SERIES_ID"

step "preview JSON source detail"
detail=$(curl -sS -H "$AUTH_HEADER" "$BASE_URL/api/v1/admin/sources/$SOURCE_ID/series/$SOURCE_SERIES_ID")
[ "$(json_get "$detail" 'data.chapterCount')" = "2" ] || fail "preview mismatch: $detail"
ok "preview returned 2 chapters"

step "import JSON source"
import=$(curl -sS -X POST -H "$AUTH_HEADER" -H "Content-Type: application/json" -d "{\"id\":\"$SOURCE_SERIES_ID\"}" "$BASE_URL/api/v1/admin/sources/$SOURCE_ID/import")
job_id=$(json_get "$import" 'data.id')
[ -n "$job_id" ] || fail "no job id: $import"
for i in 1 2 3 4 5 6 7 8 9 10; do
  payload=$(curl -sS -H "$AUTH_HEADER" "$BASE_URL/api/v1/admin/jobs/$job_id")
  job_status=$(json_get "$payload" 'data.status')
  case "$job_status" in
    completed) ok "import completed: $job_id"; break ;;
    failed) fail "import failed: $payload" ;;
  esac
  sleep 0.5
  if [ "$i" = 10 ]; then fail "import job stuck in $job_status"; fi
done

step "verify persisted data"
series_row=$(docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT slug || '|' || source_id || '|' || source_series_id FROM series WHERE slug='$IMPORTED_SLUG';")
[ "$series_row" = "$IMPORTED_SLUG|$SOURCE_ID|$SOURCE_SERIES_ID" ] || fail "series row mismatch: $series_row"
chapter_count=$(docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT count(*) FROM chapters c JOIN series s ON s.id=c.series_id WHERE s.slug='$IMPORTED_SLUG';")
[ "$chapter_count" = "2" ] || fail "expected 2 chapters, got $chapter_count"
page_count=$(docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT count(*) FROM chapter_pages cp JOIN chapters c ON c.id=cp.chapter_id JOIN series s ON s.id=c.series_id WHERE s.slug='$IMPORTED_SLUG';")
[ "$page_count" = "6" ] || fail "expected 6 pages, got $page_count"
ok "persisted $chapter_count chapters and $page_count pages"

step "sync imported series"
sync=$(curl -sS -X POST -H "$AUTH_HEADER" "$BASE_URL/api/v1/admin/series/$IMPORTED_SLUG/sync-source")
sync_id=$(json_get "$sync" 'data.id')
for i in 1 2 3 4 5 6 7 8 9 10; do
  payload=$(curl -sS -H "$AUTH_HEADER" "$BASE_URL/api/v1/admin/jobs/$sync_id")
  job_status=$(json_get "$payload" 'data.status')
  case "$job_status" in
    completed) ok "sync completed: $sync_id"; break ;;
    failed) fail "sync failed: $payload" ;;
  esac
  sleep 0.5
  if [ "$i" = 10 ]; then fail "sync job stuck in $job_status"; fi
done

step "smoke test passed"
echo "Source log: /tmp/gomic-json-source-service.log"
echo "API log: /tmp/gomic-json-source-api.log"
