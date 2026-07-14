#!/bin/sh
set -eu

PORT="${PORT:-8088}"

cd "$(dirname "$0")"
printf 'Serving Wikistr at http://localhost:%s/\n' "$PORT"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
