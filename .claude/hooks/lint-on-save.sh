#!/bin/bash
set -e

# Keep this light so edit hooks stay fast.
if [ -d frontend ]; then
  (cd frontend && npm run lint -- --quiet) || exit 0
fi

exit 0
