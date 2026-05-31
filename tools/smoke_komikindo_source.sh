#!/usr/bin/env bash
# Smoke test the KomikIndo JSON source bridge using dorobouneko-no-douzou-one-piece.
#
# This validates live KomikIndo search, detail, import, page caching, and reader
# retrieval through the PostgreSQL-backed Gomic API.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/api"
SOURCE_SERVICE="$ROOT_DIR/tools/source_service_scraper.py"

API_PORT=${API_PORT:-18190}
SOURCE_PORT=${SOURCE_PORT:-19190}
ADMIN_TOKEN=${ADMIN_TOKEN:-dev-token}
PG_CONTAINER=${PG_CONTAINER:-gomic-postgres}
DB_USER=${DB_USER:-gomic}
DB_NAME=${DB_NAME:-gomic}
DB_DSN=${DB_DSN:-postgres://gomic:gomic_dev_password@localhost:5432/gomic?sslmode=disable}
SOURCE_ID=${SOURCE_ID:-komikindo}
SOURCE_NAME=${SOURCE_NAME:-KomikIndo}
SOURCE_SERIES_ID=${SOURCE_SERIES_ID:-dorobouneko-no-douzou-one-piece}
IMPORTED_SLUG=${IMPORTED_SLUG:-dorobouneko-no-douzou-one-piece}
SEARCH_QUERY=${SEARCH_QUERY:-one piece}
CHAPTER_LIMIT=${CHAPTER_LIMIT:-1}
API_BIN=${API_BIN:-/tmp/gomic-api-komikindo-smoke}
UPLOAD_DIR=${UPLOAD_DIR:-/tmp/gomic-komikindo-uploads}
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
payload = json.loads(sys.argv[1])
for token in re.findall(r"[^.\[\]]+|\[\d+\]", sys.argv[2]):
    payload = payload[int(token[1:-1])] if token.startswith("[") else payload[token]
sys.stdout.write("" if payload is None else str(payload))
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

step "clean previous KomikIndo rows"
docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL >/dev/null
DELETE FROM series WHERE slug = '$IMPORTED_SLUG' OR source_series_id = '$SOURCE_SERIES_ID';
DELETE FROM admin_jobs WHERE payload->>'sourceId' = '$SOURCE_ID' OR payload->>'slug' = '$IMPORTED_SLUG';
SQL
rm -rf "$UPLOAD_DIR"
mkdir -p "$UPLOAD_DIR"
ok "KomikIndo rows/uploads cleared"

step "start KomikIndo source service"
"$PYTHON" "$SOURCE_SERVICE" --mode komikindo --port "$SOURCE_PORT" >/tmp/gomic-komikindo-source.log 2>&1 &
SOURCE_PID=$!
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "$SOURCE_URL/healthz" >/dev/null 2>&1; then break; fi
  sleep 0.5
  if [ "$i" = 10 ]; then tail /tmp/gomic-komikindo-source.log >&2; fail "KomikIndo source service did not become healthy"; fi
done
ok "KomikIndo source up at $SOURCE_URL"

step "build api"
( cd "$API_DIR" && go build -o "$API_BIN" ./cmd/api )
ok "binary at $API_BIN"

step "start api with KomikIndo SOURCE_URL"
DATABASE_URL="$DB_DSN" \
ADDR=":$API_PORT" \
ADMIN_TOKEN="$ADMIN_TOKEN" \
UPLOAD_DIR="$UPLOAD_DIR" \
SOURCE_ID="$SOURCE_ID" \
SOURCE_NAME="$SOURCE_NAME" \
SOURCE_URL="$SOURCE_URL" \
CLEANUP_INTERVAL=0 \
"$API_BIN" >/tmp/gomic-komikindo-api.log 2>&1 &
API_PID=$!
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "$BASE_URL/healthz" >/dev/null 2>&1; then break; fi
  sleep 0.5
  if [ "$i" = 10 ]; then tail /tmp/gomic-komikindo-api.log >&2; fail "api did not become healthy"; fi
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

step "search KomikIndo"
search=$(curl -sS -H "$AUTH_HEADER" --get --data-urlencode "q=$SEARCH_QUERY" "$BASE_URL/api/v1/admin/sources/$SOURCE_ID/search")
[ "$(json_get "$search" 'data[0].id')" = "$SOURCE_SERIES_ID" ] || fail "search failed: $search"
ok "search returned $SOURCE_SERIES_ID"

step "preview KomikIndo detail"
detail=$(curl -sS -H "$AUTH_HEADER" "$BASE_URL/api/v1/admin/sources/$SOURCE_ID/series/$SOURCE_SERIES_ID")
[ "$(json_get "$detail" 'data.chapterCount')" = "1" ] || fail "preview mismatch: $detail"
ok "preview returned 1 chapter"

step "import KomikIndo series"
import=$(curl -sS -X POST -H "$AUTH_HEADER" -H "Content-Type: application/json" -d "{\"id\":\"$SOURCE_SERIES_ID\",\"chapterLimit\":$CHAPTER_LIMIT}" "$BASE_URL/api/v1/admin/sources/$SOURCE_ID/import")
job_id=$(json_get "$import" 'data.id')
[ -n "$job_id" ] || fail "no job id: $import"
for i in $(seq 1 120); do
  payload=$(curl -sS -H "$AUTH_HEADER" "$BASE_URL/api/v1/admin/jobs/$job_id")
  job_status=$(json_get "$payload" 'data.status')
  case "$job_status" in
    completed) ok "import completed: $job_id"; break ;;
    failed) fail "import failed: $payload" ;;
  esac
  sleep 1
  if [ "$i" = 120 ]; then fail "import job stuck in $job_status"; fi
done

step "verify persisted reader data"
series=$(curl -sS "$BASE_URL/api/v1/series/$IMPORTED_SLUG")
[ "$(json_get "$series" 'data.slug')" = "$IMPORTED_SLUG" ] || fail "series detail missing: $series"
chapter_slug=$(json_get "$series" 'data.chapters[0].slug')
page_count=$(json_get "$series" 'data.chapters[0].pageCount')
imported_count=$(json_get "$series" 'data.chapterCount')
[ "$imported_count" = "$CHAPTER_LIMIT" ] || fail "expected $CHAPTER_LIMIT imported chapters, got $imported_count"
[ "$page_count" -gt 0 ] || fail "expected cached pages in first chapter: $series"
reader=$(curl -sS "$BASE_URL/api/v1/series/$IMPORTED_SLUG/chapters/$chapter_slug")
first_page=$(json_get "$reader" 'data.chapter.pages[0].imageUrl')
case "$first_page" in
  /uploads/source-cache/*) ok "reader exposes cached page $first_page" ;;
  *) fail "unexpected first page URL: $first_page" ;;
esac
ok "persisted $SOURCE_SERIES_ID with first chapter $chapter_slug and $page_count pages"

step "KomikIndo smoke test passed"
echo "Source log: /tmp/gomic-komikindo-source.log"
echo "API log: /tmp/gomic-komikindo-api.log"
