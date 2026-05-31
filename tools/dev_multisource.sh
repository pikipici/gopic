#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
API_DIR="$ROOT_DIR/api"
WEB_DIR="$ROOT_DIR/web"

API_PORT=${API_PORT:-18190}
WEB_PORT=${WEB_PORT:-13000}
KOMIKCAST_PORT=${KOMIKCAST_PORT:-19190}
KOMIKINDO_PORT=${KOMIKINDO_PORT:-19191}
ADMIN_TOKEN=${ADMIN_TOKEN:-dev-token}
DATABASE_URL=${DATABASE_URL:-postgres://gomic:gomic_dev_password@localhost:5432/gomic?sslmode=disable}
UPLOAD_DIR=${UPLOAD_DIR:-$API_DIR/uploads}

PIDS=()

cleanup() {
  local status=$?
  if [ ${#PIDS[@]} -gt 0 ]; then
    echo
    echo "Stopping dev services..."
    for pid in "${PIDS[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
      fi
    done
  fi
  exit "$status"
}
trap cleanup INT TERM EXIT

url_ready() {
  curl -fsS "$1" >/dev/null 2>&1
}

wait_for_url() {
  local label=$1
  local url=$2
  local tries=${3:-40}
  for _ in $(seq 1 "$tries"); do
    if url_ready "$url"; then
      echo "OK  $label -> $url"
      return 0
    fi
    sleep 1
  done
  echo "FAIL $label did not become ready: $url" >&2
  return 1
}

start_service() {
  local label=$1
  shift
  echo "Starting $label..."
  "$@" &
  PIDS+=("$!")
}

SOURCES_JSON=$(cat <<JSON
[{"id":"komikcast","name":"Komik Cast","url":"http://localhost:${KOMIKCAST_PORT}"},{"id":"komikindo","name":"KomikIndo","url":"http://localhost:${KOMIKINDO_PORT}"}]
JSON
)

echo "Running database migrations..."
(
  cd "$API_DIR"
  DATABASE_URL="$DATABASE_URL" go run ./cmd/migrate
)

start_service "KomikCast scraper" python "$ROOT_DIR/tools/source_service_scraper.py" --mode komikcast --port "$KOMIKCAST_PORT"
start_service "KomikIndo scraper" python "$ROOT_DIR/tools/source_service_scraper.py" --mode komikindo --port "$KOMIKINDO_PORT"
start_service "Gomic API" bash -c '
  cd "$1"
  shift
  env "$@" go run ./cmd/api
' _ "$API_DIR" \
  ADDR=":$API_PORT" \
  DATABASE_URL="$DATABASE_URL" \
  ADMIN_TOKEN="$ADMIN_TOKEN" \
  UPLOAD_DIR="$UPLOAD_DIR" \
  SOURCES_JSON="$SOURCES_JSON"
if url_ready "http://127.0.0.1:$WEB_PORT/admin"; then
  echo "OK  Gomic web already running -> http://127.0.0.1:$WEB_PORT/admin"
else
  start_service "Gomic web" env \
    NEXT_PUBLIC_API_BASE_URL="http://localhost:$API_PORT" \
    npm --prefix "$WEB_DIR" run dev -- --hostname 127.0.0.1 --port "$WEB_PORT"
fi

wait_for_url "KomikCast scraper" "http://localhost:$KOMIKCAST_PORT/healthz"
wait_for_url "KomikIndo scraper" "http://localhost:$KOMIKINDO_PORT/healthz"
wait_for_url "Gomic API" "http://localhost:$API_PORT/healthz"
wait_for_url "Gomic web admin" "http://127.0.0.1:$WEB_PORT/admin"

echo
echo "Dev stack is ready."
echo "Admin UI: http://127.0.0.1:$WEB_PORT/admin"
echo "Admin token: $ADMIN_TOKEN"
echo "API: http://localhost:$API_PORT"
echo "KomikCast scraper: http://localhost:$KOMIKCAST_PORT"
echo "KomikIndo scraper: http://localhost:$KOMIKINDO_PORT"
echo
echo "Press Ctrl+C to stop all services."

wait
