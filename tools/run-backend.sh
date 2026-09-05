#!/usr/bin/env bash
# POSIX mirror of tools/run-backend.cmd — JDK 17 discovery + Maven launcher for macOS/Linux.
# Usage: tools/run-backend.sh             # launch Spring Boot
#        tools/run-backend.sh --check-only # only verify JDK, then exit 0
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MAVEN_REPO="$ROOT/.m2repo"
CHECK_ONLY=0
JAVA_HOME_RESOLVED=""

if [ "${1:-}" = "--check-only" ]; then
  CHECK_ONLY=1
fi

echo "[Hermes] Hunting for JDK 17 and Maven..."

# --- Load local env from .env if present (mirrors the .cmd loading Hermes.local.env.ps1) ---
if [ -f "$ROOT/.env" ]; then
  echo "[Hermes] Loading local env from .env..."
  set -a
  # shellcheck disable=SC1090
  . "$ROOT/.env"
  set +a
fi

# --- JDK discovery ---
# 1) Honor an explicit JAVA_HOME if it points at a usable java.
if [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ]; then
  JAVA_HOME_RESOLVED="$JAVA_HOME"
# 2) macOS: ask the JVM helper for a JDK 17+.
elif [ -x /usr/libexec/java_home ] && resolved_home="$(/usr/libexec/java_home -v 17+ 2>/dev/null)" && [ -n "$resolved_home" ]; then
  JAVA_HOME_RESOLVED="$resolved_home"
# 3) macOS Homebrew keg-only JDKs (openjdk@17 etc.) are not registered with
#    /usr/libexec/java_home, so detect them explicitly.
elif [ -x /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home/bin/java ]; then
  JAVA_HOME_RESOLVED="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
elif [ -x /opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home/bin/java ]; then
  JAVA_HOME_RESOLVED="/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home"
elif [ -x /usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home/bin/java ]; then
  JAVA_HOME_RESOLVED="/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
fi

if [ -n "$JAVA_HOME_RESOLVED" ]; then
  export JAVA_HOME="$JAVA_HOME_RESOLVED"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

# Locate the java binary on PATH.
if ! command -v java >/dev/null 2>&1; then
  echo "[Hermes] Java 17 was not found."
  echo "[Hermes] Install Java 17 (e.g. brew install openjdk@17) or set JAVA_HOME before starting Hermes."
  exit 1
fi

# --- Validate Java major version >= 17 ---
JAVA_VERSION_LINE="$(java -version 2>&1 | grep -i version | head -n1 || true)"
JAVA_VERSION="$(printf '%s\n' "$JAVA_VERSION_LINE" | sed -nE 's/.*"([0-9]+(\.[0-9]+)*).*".*/\1/p' | head -n1)"

if [ -z "$JAVA_VERSION" ]; then
  echo "[Hermes] Could not determine the installed Java version."
  echo "[Hermes] Install Java 17 (e.g. brew install openjdk@17) or set JAVA_HOME before starting Hermes."
  exit 1
fi

JAVA_MAJOR="${JAVA_VERSION%%.*}"
# Strip a leading 1. on legacy 1.8 style versions.
if [ "$JAVA_MAJOR" = "1" ]; then
  JAVA_MINOR="$(printf '%s\n' "$JAVA_VERSION" | cut -d. -f2)"
  JAVA_MAJOR="$JAVA_MINOR"
fi

if [ "$JAVA_MAJOR" -lt 17 ]; then
  echo "[Hermes] Java $JAVA_VERSION was found, but Hermes requires Java 17 or later."
  echo "[Hermes] Install Java 17 (e.g. brew install openjdk@17) or set JAVA_HOME before starting Hermes."
  exit 1
fi

echo "[Hermes] JDK 17+ locked in (Java $JAVA_VERSION)."

if [ "$CHECK_ONLY" -eq 1 ]; then
  exit 0
fi

# --- Launch Spring Boot via the Maven wrapper ---
# Memory-optimized JVM flags for small servers (2GB RAM) — mirrors run-backend.cmd.
export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:--Xmx768m -Xms256m -XX:+UseSerialGC -XX:MaxMetaspaceSize=192m}"

cd "$ROOT/backend"
echo "[Hermes] Igniting Spring Boot..."
exec ./mvnw -Dmaven.repo.local="$MAVEN_REPO" -Dmaven.test.skip=true \
  org.springframework.boot:spring-boot-maven-plugin:run
