#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
API_DIR="$ROOT_DIR/api"
WEB_DIR="$ROOT_DIR/web"

API_PORT=${API_PORT:-18190}
WEB_PORT=${WEB_PORT:-13000}
KOMIKCAST_PORT=${KOMIKCAST_PORT:-19190}
KOMIKINDO_PORT=${KOMIKINDO_PORT:-19191}
ASURASCANS_PORT=${ASURASCANS_PORT:-19200}
MANGAPILL_PORT=${MANGAPILL_PORT:-19201}
WEBCENTRAL_PORT=${WEBCENTRAL_PORT:-19202}
KOMIKU_PORT=${KOMIKU_PORT:-19203}
MANGASUSU_PORT=${MANGASUSU_PORT:-19204}
KIRYUU_PORT=${KIRYUU_PORT:-19205}
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

port_pid() {
  local port=$1
  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "\$conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if (\$conn) { \$conn.OwningProcess }" 2>/dev/null | tr -d '\r'
  fi
}

process_command_line() {
  local pid=$1
  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "\$proc = Get-CimInstance Win32_Process -Filter 'ProcessId = $pid' -ErrorAction SilentlyContinue; if (\$proc) { \$proc.CommandLine }" 2>/dev/null | tr -d '\r'
  fi
}

stop_process_tree() {
  local pid=$1
  if command -v taskkill.exe >/dev/null 2>&1; then
    taskkill.exe //PID "$pid" //T //F >/dev/null 2>&1 || true
  elif kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
  fi
}

ensure_clean_owned_port() {
  local port=$1
  local label=$2
  local match=$3
  local pid command_line
  pid=$(port_pid "$port" | sed -n '1p' || true)
  if [ -z "${pid:-}" ]; then
    return 0
  fi

  command_line=$(process_command_line "$pid")
  if printf '%s' "$command_line" | grep -Ei "$match" >/dev/null 2>&1; then
    echo "Restarting stale $label on port $port (pid $pid)..."
    stop_process_tree "$pid"
    sleep 2
    return 0
  fi

  echo "FAIL port $port is already used by another process (pid $pid)." >&2
  echo "     Command: $command_line" >&2
  return 2
}

ensure_clean_web_port() {
  local pid command_line web_dir_for_match web_dir_win_for_match
  pid=$(port_pid "$WEB_PORT" | sed -n '1p' || true)
  if [ -z "${pid:-}" ]; then
    return 0
  fi

  command_line=$(process_command_line "$pid")
  web_dir_for_match=${WEB_DIR//\\/\\\\}
  web_dir_win_for_match=$web_dir_for_match
  if command -v cygpath >/dev/null 2>&1; then
    web_dir_win_for_match=$(cygpath -w "$WEB_DIR")
    web_dir_win_for_match=${web_dir_win_for_match//\\/\\\\}
  fi

  if { printf '%s' "$command_line" | grep -F "$web_dir_for_match" >/dev/null 2>&1 || printf '%s' "$command_line" | grep -F "$web_dir_win_for_match" >/dev/null 2>&1; } && printf '%s' "$command_line" | grep -Ei 'next|node|npm' >/dev/null 2>&1; then
    echo "Restarting stale Gomic web dev server on port $WEB_PORT (pid $pid)..."
    stop_process_tree "$pid"
    sleep 2
    return 0
  fi

  if url_ready "http://127.0.0.1:$WEB_PORT/admin"; then
    echo "OK  Gomic web already running -> http://127.0.0.1:$WEB_PORT/admin"
    return 1
  fi

  echo "FAIL port $WEB_PORT is already used by another process (pid $pid)." >&2
  echo "     Command: $command_line" >&2
  return 2
}

SOURCES_JSON=$(cat <<JSON
[{"id":"komikcast","name":"Komik Cast","url":"http://localhost:${KOMIKCAST_PORT}"},{"id":"komikindo","name":"KomikIndo","url":"http://localhost:${KOMIKINDO_PORT}"},{"id":"asurascans","name":"Asura Scans","url":"http://localhost:${ASURASCANS_PORT}"},{"id":"mangapill","name":"MangaPill","url":"http://localhost:${MANGAPILL_PORT}"},{"id":"weebcentral","name":"Weeb Central","url":"http://localhost:${WEBCENTRAL_PORT}"},{"id":"komiku","name":"Komiku","url":"http://localhost:${KOMIKU_PORT}"},{"id":"mangasusu","name":"Mangasusu","url":"http://localhost:${MANGASUSU_PORT}"},{"id":"kiryuu","name":"Kiryuu","url":"http://localhost:${KIRYUU_PORT}"}]
JSON
)

echo "Running database migrations..."
(
  cd "$API_DIR"
  DATABASE_URL="$DATABASE_URL" go run ./cmd/migrate
)

ensure_clean_owned_port "$KOMIKCAST_PORT" "KomikCast scraper" 'source_service_scraper|scrapers|python'
ensure_clean_owned_port "$KOMIKINDO_PORT" "KomikIndo scraper" 'source_service_scraper|scrapers|python'
ensure_clean_owned_port "$ASURASCANS_PORT" "Asura Scans scraper" 'scrapers|python'
ensure_clean_owned_port "$MANGAPILL_PORT" "MangaPill scraper" 'scrapers|python'
ensure_clean_owned_port "$WEBCENTRAL_PORT" "Weeb Central scraper" 'scrapers|python'
ensure_clean_owned_port "$KOMIKU_PORT" "Komiku scraper" 'scrapers|python'
ensure_clean_owned_port "$MANGASUSU_PORT" "Mangasusu scraper" 'scrapers|python'
ensure_clean_owned_port "$KIRYUU_PORT" "Kiryuu scraper" 'scrapers|python'
ensure_clean_owned_port "$API_PORT" "Gomic API" 'gomic|cmd/api|go.exe|go run|api'

start_service "KomikCast scraper" python -m tools.scrapers --source komikcast --port "$KOMIKCAST_PORT"
start_service "KomikIndo scraper" python -m tools.scrapers --source komikindo --port "$KOMIKINDO_PORT"
start_service "Asura Scans scraper" python -m tools.scrapers --source asurascans --port "$ASURASCANS_PORT"
start_service "MangaPill scraper" python -m tools.scrapers --source mangapill --port "$MANGAPILL_PORT"
start_service "Weeb Central scraper" python -m tools.scrapers --source weebcentral --port "$WEBCENTRAL_PORT"
start_service "Komiku scraper" python -m tools.scrapers --source komiku --port "$KOMIKU_PORT"
start_service "Mangasusu scraper" python -m tools.scrapers --source mangasusu --port "$MANGASUSU_PORT"
start_service "Kiryuu scraper" python -m tools.scrapers --source kiryuu --port "$KIRYUU_PORT"
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
if ensure_clean_web_port; then
  start_service "Gomic web" env \
    NEXT_PUBLIC_API_BASE_URL="http://localhost:$API_PORT" \
    npm --prefix "$WEB_DIR" run dev -- --hostname 127.0.0.1 --port "$WEB_PORT"
fi

wait_for_url "KomikCast scraper" "http://localhost:$KOMIKCAST_PORT/healthz"
wait_for_url "KomikIndo scraper" "http://localhost:$KOMIKINDO_PORT/healthz"
wait_for_url "Asura Scans scraper" "http://localhost:$ASURASCANS_PORT/healthz"
wait_for_url "MangaPill scraper" "http://localhost:$MANGAPILL_PORT/healthz"
wait_for_url "Weeb Central scraper" "http://localhost:$WEBCENTRAL_PORT/healthz"
wait_for_url "Komiku scraper" "http://localhost:$KOMIKU_PORT/healthz"
wait_for_url "Mangasusu scraper" "http://localhost:$MANGASUSU_PORT/healthz"
wait_for_url "Kiryuu scraper" "http://localhost:$KIRYUU_PORT/healthz"
wait_for_url "Gomic API" "http://localhost:$API_PORT/healthz"
wait_for_url "Gomic web admin" "http://127.0.0.1:$WEB_PORT/admin"

echo
echo "Dev stack is ready."
echo "Admin UI: http://127.0.0.1:$WEB_PORT/admin"
echo "Admin token: $ADMIN_TOKEN"
echo "API: http://localhost:$API_PORT"
echo "KomikCast scraper: http://localhost:$KOMIKCAST_PORT"
echo "KomikIndo scraper: http://localhost:$KOMIKINDO_PORT"
echo "Asura Scans scraper: http://localhost:$ASURASCANS_PORT"
echo "MangaPill scraper: http://localhost:$MANGAPILL_PORT"
echo "Weeb Central scraper: http://localhost:$WEBCENTRAL_PORT"
echo "Komiku scraper: http://localhost:$KOMIKU_PORT"
echo "Mangasusu scraper: http://localhost:$MANGASUSU_PORT"
echo "Kiryuu scraper: http://localhost:$KIRYUU_PORT"
echo
echo "Press Ctrl+C to stop all services."

wait
