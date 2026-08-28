#!/usr/bin/env bash
# POSIX mirror of start_hermes.bat — one-shot Hermes stack launcher for macOS/Linux.
# Builds the frontend, frees :8080, starts the Spring Boot backend (+ optional Python
# VDOT engine and auto-import watcher), polls for health, and opens the browser.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_URL="http://localhost:8080"
HEALTH_URL="http://localhost:8080"
BACKEND_LOG="$ROOT/backend_log.txt"
SYNC_CONFIG="$ROOT/.tools/hermes_sync_config.json"
PYTHON_EXE=""

echo "=========================================="
echo "       STARTING HERMES TECH STACK"
echo "=========================================="

startup_failed() {
  echo "=========================================="
  echo "Hermes did not finish starting."
  echo "=========================================="
  exit 1
}

# --- Load local env from .env if present (mirrors .bat loading Hermes.local.env.ps1) ---
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ROOT/.env"
  set +a
  echo "[Hermes] Loaded local env from .env"
else
  echo "[Hermes] .env not found. Using existing shell env only."
fi

# --- Detect a Python venv (POSIX layout) ---
if [ -x "$ROOT/.venv/bin/python" ]; then
  PYTHON_EXE="$ROOT/.venv/bin/python"
elif [ -x "$ROOT/backend/venv/bin/python" ]; then
  PYTHON_EXE="$ROOT/backend/venv/bin/python"
fi

# --- Free localhost:8080 if something is already listening ---
if command -v lsof >/dev/null 2>&1 && lsof -ti:8080 >/dev/null 2>&1; then
  echo "[Hermes] Stopping old backend on localhost:8080..."
  lsof -ti:8080 | xargs kill -9 2>/dev/null || true
  sleep 2
  if lsof -ti:8080 >/dev/null 2>&1; then
    echo "[Hermes] Could not stop the existing backend on localhost:8080."
    echo "[Hermes] Stop its Java process manually, then run ./start_hermes.sh again."
    startup_failed
  fi
fi

# 1. Build frontend static assets before the backend can serve an old app shell.
echo "[1/5] Building frontend static assets..."
( cd "$ROOT/frontend" && node scripts/run-vite-build.mjs ) || {
  echo "[Hermes] Frontend build failed. Fix Vite/build errors before starting Hermes."
  startup_failed
}

# 2. Check backend requirements before opening any windows
echo "[2/5] Checking Spring Boot requirements..."
"$ROOT/.tools/run-backend.sh" --check-only || startup_failed

# 3. Launch the backend in the background, writing logs to backend_log.txt
echo "[2/4] Waking up Spring Boot (Java)..."
: > "$BACKEND_LOG"
"$ROOT/.tools/run-backend.sh" >>"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

# 4. Start the Python auto-import watcher when a local virtualenv is available
if [ -n "$PYTHON_EXE" ]; then
  if [ -f "$SYNC_CONFIG" ]; then
    echo "[3/4] Waking up Hermes auto-import watcher..."
    "$PYTHON_EXE" "$ROOT/.tools/hermes_auto_sync.py" "$SYNC_CONFIG" >/dev/null 2>&1 &
  else
    echo "[3/4] Auto-import watcher not started."
    echo "      To enable: cp .tools/hermes_sync_config.example.json .tools/hermes_sync_config.json"
    echo "      then set auth email/password and import folders. See README \"Garmin / COROS Auto-Import\"."
  fi
else
  echo "[3/4] Skipping auto-import watcher. No local virtualenv was found."
  echo "      To enable: python3 -m venv .venv"
fi

# 5. Wait until Spring Boot serves the site before opening the browser
wait_for_backend() {
  echo "[4/4] Waiting for Spring Boot on localhost:8080..."
  for _ in $(seq 1 30); do
    if curl -sf -o /dev/null --max-time 2 "$HEALTH_URL"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

retry_backend() {
  echo "[2/4] Waking up Spring Boot (Java)..."
  : > "$BACKEND_LOG"
  "$ROOT/.tools/run-backend.sh" >>"$BACKEND_LOG" 2>&1 &
  BACKEND_PID=$!
}

BACKEND_RETRY_DONE=0
if ! wait_for_backend; then
  if [ "$BACKEND_RETRY_DONE" -eq 0 ] && grep -qE "NoClassDefFoundError: com/hermes/backend/|ClassNotFoundException: com\.hermes\.backend\." "$BACKEND_LOG" 2>/dev/null; then
    echo "[Hermes] Spring Boot hit a stale backend class error. Retrying once..."
    BACKEND_RETRY_DONE=1
    sleep 2
    retry_backend
    if ! wait_for_backend; then
      echo "[Warn] Spring Boot did not answer on localhost:8080 within 30 seconds."
      echo "[Warn] Check $BACKEND_LOG for startup errors."
      echo "[Warn] Once it is ready, open $APP_URL manually."
      startup_failed
    fi
  else
    echo "[Warn] Spring Boot did not answer on localhost:8080 within 30 seconds."
    echo "[Warn] Check $BACKEND_LOG for startup errors."
    echo "[Warn] Once it is ready, open $APP_URL manually."
    startup_failed
  fi
fi

echo "Launching Hermes..."
if command -v open >/dev/null 2>&1; then
  open "$APP_URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$APP_URL"
fi
echo "=========================================="
echo "Hermes is online! (backend pid $BACKEND_PID)"
echo "Stop it with ./stop_hermes.sh"
echo "=========================================="
