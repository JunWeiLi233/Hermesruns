#!/usr/bin/env bash
# POSIX mirror of stop_hermes.bat — shuts down the Hermes stack on macOS/Linux.
# Stops the Spring Boot backend (port 8080 + spring-boot:run processes) and any
# Python VDOT engine / auto-import watcher.
set -uo pipefail

echo "=========================================="
echo "       SHUTTING DOWN HERMES STACK"
echo "=========================================="

echo "Stopping Java (Spring Boot)..."
if command -v lsof >/dev/null 2>&1; then
  lsof -ti:8080 2>/dev/null | xargs kill -9 2>/dev/null || true
fi
pkill -f "spring-boot:run" 2>/dev/null || true

echo "Stopping Python (VDOT Engine / auto-import watcher)..."
pkill -f "vdot_engine.py" 2>/dev/null || true
pkill -f "hermes_auto_sync.py" 2>/dev/null || true

echo "=========================================="
echo "All Hermes systems are offline."
echo "=========================================="
