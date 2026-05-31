#!/usr/bin/env bash
# Gomic admin Mihon-bridge smoke test.
#
# Validates against a real PostgreSQL backend that:
#   - migrations apply cleanly (idempotent re-run)
#   - admin source list, search, import, sync work end-to-end
#   - catalog rows + admin_jobs rows appear in the DB
#   - cleanup loop prunes old finished jobs
#
# Usage:
#   tools/smoke_admin_mihon.sh
#
# Env overrides:
#   API_PORT          default 18090
#   ADMIN_TOKEN       default dev-token
#   PG_CONTAINER      default gomic-postgres
#   DB_USER / DB_NAME default gomic / gomic
#   DB_DSN            default postgres://gomic:gomic_dev_password@localhost:5432/gomic?sslmode=disable
#   UPLOAD_DIR        default /tmp/gomic-uploads-smoke
#   API_BIN           default /tmp/gomic-api-smoke
#   PYTHON            default python (override if needed, e.g. python3)
#   KEEP_RUNNING=1    skip teardown of API process (db container always left alone)

set -euo pipefail

API_PORT=${API_PORT:-18090}
ADMIN_TOKEN=${ADMIN_TOKEN:-dev-token}
PG_CONTAINER=${PG_CONTAINER:-gomic-postgres}
DB_USER=${DB_USER:-gomic}
DB_NAME=${DB_NAME:-gomic}
DB_DSN=${DB_DSN:-postgres://gomic:gomic_dev_password@localhost:5432/gomic?sslmode=disable}
UPLOAD_DIR=${UPLOAD_DIR:-/tmp/gomic-uploads-smoke}
API_BIN=${API_BIN:-/tmp/gomic-api-smoke}
PYTHON=${PYTHON:-python}
KEEP_RUNNING=${KEEP_RUNNING:-0}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/api"
MIGRATION="$API_DIR/migrations/001_catalog_schema.sql"
BASE_URL="http://localhost:$API_PORT"
AUTH_HEADER="Authorization: Bearer $ADMIN_TOKEN"

step() { printf "\n\033[1;36m== %s ==\033[0m\n" "$*"; }
ok()   { printf "  \033[1;32mok\033[0m %s\n" "$*"; }
fail() { printf "  \033[1;31mfail\033[0m %s\n" "$*" >&2; exit 1; }

# json_get '<json>' '<dotted.path[0].path>' -> stdout
json_get() {
  "$PYTHON" - "$1" "$2" <<'PYEOF'
import json, re, sys
data = json.loads(sys.argv[1])
path = sys.argv[2]
for token in re.findall(r"[^.\[\]]+|\[\d+\]", path):
    if token.startswith("[") and token.endswith("]"):
        data = data[int(token[1:-1])]
    else:
        data = data[token]
sys.stdout.write("" if data is None else str(data))
PYEOF
}

API_PID=""
cleanup() {
  if [ "$KEEP_RUNNING" = "1" ]; then
    return
  fi
  if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

step "preflight"
command -v docker >/dev/null   || fail "docker not in PATH"
command -v curl   >/dev/null   || fail "curl not in PATH"
command -v "$PYTHON" >/dev/null || fail "$PYTHON not in PATH (set PYTHON=...)"
docker inspect "$PG_CONTAINER" >/dev/null 2>&1 \
  || fail "postgres container '$PG_CONTAINER' not found. run: docker compose up -d postgres"
status=$(docker inspect -f '{{.State.Health.Status}}' "$PG_CONTAINER" 2>/dev/null || echo unknown)
[ "$status" = "healthy" ] || fail "postgres container '$PG_CONTAINER' status=$status (expected healthy)"
ok "docker + postgres healthy"

step "apply migration"
docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$MIGRATION" >/tmp/gomic-smoke-migrate.log 2>&1 \
  || { cat /tmp/gomic-smoke-migrate.log >&2; fail "migration failed"; }
ok "migration applied"

step "reset state"
docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
  "TRUNCATE TABLE chapter_pages, chapters, series_genres, series, admin_jobs RESTART IDENTITY CASCADE;" >/dev/null
rm -rf "$UPLOAD_DIR"
mkdir -p "$UPLOAD_DIR"
ok "db tables truncated, uploads cleared"

step "build api"
( cd "$API_DIR" && go build -o "$API_BIN" ./cmd/api )
ok "binary at $API_BIN"

step "start api"
DATABASE_URL="$DB_DSN" \
ADDR=":$API_PORT" \
ADMIN_TOKEN="$ADMIN_TOKEN" \
UPLOAD_DIR="$UPLOAD_DIR" \
CLEANUP_INTERVAL='10s' \
JOB_RETENTION='1m' \
CACHE_TTL='1m' \
"$API_BIN" >/tmp/gomic-smoke-api.log 2>&1 &
API_PID=$!
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "$BASE_URL/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
curl -sf "$BASE_URL/healthz" >/dev/null || { tail /tmp/gomic-smoke-api.log >&2; fail "api did not become healthy on $BASE_URL"; }
ok "api up at $BASE_URL (pid $API_PID)"

step "GET /api/v1/admin/sources"
sources=$(curl -sS -H "$AUTH_HEADER" "$BASE_URL/api/v1/admin/sources")
[ "$(json_get "$sources" 'data[0].id')" = "mock-mihon" ] || fail "expected mock-mihon source. got: $sources"
ok "source registry exposes mock-mihon"

step "search source"
search=$(curl -sS -H "$AUTH_HEADER" "$BASE_URL/api/v1/admin/sources/mock-mihon/search?q=neon")
[ "$(json_get "$search" 'data[0].id')" = "neon-rain" ] || fail "search miss. got: $search"
ok "search returns neon-rain"

step "import series via job"
import=$(curl -sS -X POST -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d '{"id":"neon-rain"}' "$BASE_URL/api/v1/admin/sources/mock-mihon/import")
job_id=$(json_get "$import" 'data.id')
[ -n "$job_id" ] || fail "no job id. got: $import"
for i in 1 2 3 4 5 6 7 8 9 10; do
  payload=$(curl -sS -H "$AUTH_HEADER" "$BASE_URL/api/v1/admin/jobs/$job_id")
  status=$(json_get "$payload" 'data.status')
  case "$status" in
    completed) ok "import completed: $job_id"; break ;;
    failed)    fail "import job failed: $payload" ;;
  esac
  sleep 0.5
  if [ "$i" = 10 ]; then fail "import job stuck in $status"; fi
done

step "verify db rows"
series_row=$(docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT slug || '|' || source_id || '|' || source_series_id FROM series WHERE source_series_id='neon-rain';")
[ "$series_row" = "neon-rain-protocol|mock-mihon|neon-rain" ] || fail "series row mismatch: '$series_row'"
chapter_count=$(docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT count(*) FROM chapters c JOIN series s ON s.id=c.series_id WHERE s.slug='neon-rain-protocol';")
[ "$chapter_count" = "2" ] || fail "expected 2 chapters, got $chapter_count"
page_count=$(docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT count(*) FROM chapter_pages cp JOIN chapters c ON c.id=cp.chapter_id JOIN series s ON s.id=c.series_id WHERE s.slug='neon-rain-protocol';")
[ "$page_count" -gt 0 ] || fail "expected >0 chapter pages, got $page_count"
ok "series + $chapter_count chapters + $page_count pages persisted"

step "sync existing series"
sync=$(curl -sS -X POST -H "$AUTH_HEADER" "$BASE_URL/api/v1/admin/series/neon-rain-protocol/sync-source")
sync_id=$(json_get "$sync" 'data.id')
for i in 1 2 3 4 5 6 7 8 9 10; do
  payload=$(curl -sS -H "$AUTH_HEADER" "$BASE_URL/api/v1/admin/jobs/$sync_id")
  status=$(json_get "$payload" 'data.status')
  case "$status" in
    completed) ok "sync completed: $sync_id"; break ;;
    failed)    fail "sync job failed: $payload" ;;
  esac
  sleep 0.5
  if [ "$i" = 10 ]; then fail "sync job stuck in $status"; fi
done

step "list jobs"
list_payload=$(curl -sS -H "$AUTH_HEADER" "$BASE_URL/api/v1/admin/jobs?limit=10")
jobs_total=$(json_get "$list_payload" 'meta.total')
[ "$jobs_total" -ge 2 ] || fail "expected >=2 jobs in list, got $jobs_total"
ok "admin/jobs listing returns $jobs_total entries"

step "wait for cleanup loop (90s)"
sleep 90
remaining_payload=$(curl -sS -H "$AUTH_HEADER" "$BASE_URL/api/v1/admin/jobs?limit=10")
remaining=$(json_get "$remaining_payload" 'meta.total')
[ "$remaining" = "0" ] || fail "expected 0 jobs after retention window, got $remaining"
ok "cleanup loop pruned finished jobs"

step "smoke test passed"
echo "API log: /tmp/gomic-smoke-api.log"
echo "Set KEEP_RUNNING=1 to leave the API process alive on port $API_PORT."
