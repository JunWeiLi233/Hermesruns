#!/bin/bash
set -e

# Run the cheapest meaningful checks before commit.

echo "Running frontend lint..."
(cd frontend && npm run lint)

echo "Running backend compile..."
(cd backend && ./mvnw -q -DskipTests compile)

echo "Pre-commit checks passed."
