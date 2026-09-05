#!/usr/bin/env bash
# POSIX mirror of migrate_h2_to_postgres.bat — one-shot H2 -> PostgreSQL migration.
# Requires the H2 and PostgreSQL JDBC drivers under ~/.m2/repository or ./.m2repo,
# which Spring Boot's Maven wrapper downloads on first backend build.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

H2_URL="${APP_H2_URL:-jdbc:h2:file:./backend/hermes_db_v2;AUTO_SERVER=TRUE}"

if [ -z "${APP_DB_URL:-}" ]; then
  echo "APP_DB_URL is not set."
  echo "Example: export APP_DB_URL='jdbc:postgresql://localhost:5432/hermes'"
  exit 1
fi
if [ -z "${APP_DB_USERNAME:-}" ]; then
  echo "APP_DB_USERNAME is not set."
  exit 1
fi

# Search both the shared Maven repo and the repo-local .m2repo used by run-backend.sh.
SEARCH_DIRS=("$HOME/.m2/repository" "$ROOT/.m2repo")
H2_JAR=""
PG_JAR=""
for base in "${SEARCH_DIRS[@]}"; do
  if [ -z "$H2_JAR" ]; then
    found="$(find "$base/com/h2database/h2" -name 'h2-*.jar' 2>/dev/null | head -n1 || true)"
    [ -n "$found" ] && H2_JAR="$found"
  fi
  if [ -z "$PG_JAR" ]; then
    found="$(find "$base/org/postgresql/postgresql" -name 'postgresql-*.jar' 2>/dev/null | head -n1 || true)"
    [ -n "$found" ] && PG_JAR="$found"
  fi
done

if [ -z "$H2_JAR" ]; then
  echo "Could not find the H2 JDBC driver under ~/.m2/repository or $ROOT/.m2repo."
  echo "Run the backend once first (./start_hermes.sh) so Maven downloads the drivers."
  exit 1
fi
if [ -z "$PG_JAR" ]; then
  echo "Could not find the PostgreSQL JDBC driver under ~/.m2/repository or $ROOT/.m2repo."
  echo "Run the backend once first (./start_hermes.sh) so Maven downloads the drivers."
  exit 1
fi

# POSIX Java classpath separator is ':'. (The Windows .bat uses ';'.)
CP="$H2_JAR:$PG_JAR:."

echo "Migrating Hermes data from H2 to PostgreSQL..."
( cd "$ROOT" && java --class-path "$CP" tools/H2ToPostgresMigrator.java \
  "$H2_URL" "$APP_DB_URL" "$APP_DB_USERNAME" "${APP_DB_PASSWORD:-}" --truncate ) || {
  echo "Migration failed."
  exit 1
}

echo "Migration finished."
