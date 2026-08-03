#!/usr/bin/env bash
# Boots the mock stack, runs the Maestro flows against an already-installed
# e2e Release build, and tears the mock down. Build the app first with
# `pnpm test:e2e:build`.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
PORT="${MOCK_STACK_PORT:-8787}"

MOCK_PID=""
cleanup() {
  if [ -n "$MOCK_PID" ] && kill -0 "$MOCK_PID" 2>/dev/null; then
    kill "$MOCK_PID" 2>/dev/null || true
    wait "$MOCK_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

MOCK_STACK_PORT="$PORT" deno run -A "$APP_DIR/.maestro/mock-stack/server.ts" &
MOCK_PID=$!

MOCK_READY=""
for _ in $(seq 1 30); do
  if curl -sf "http://localhost:$PORT/.well-known/nostr.json?name=e2etester" >/dev/null; then
    MOCK_READY=1
    break
  fi
  sleep 0.2
done

if [ -z "$MOCK_READY" ]; then
  echo "mock stack did not come up on port $PORT" >&2
  exit 1
fi

maestro test "$APP_DIR/.maestro/flows" "$@"
