#!/usr/bin/env bash
set -euo pipefail

# Use a memorable Nostroots/Nostr-related default port.
PORT="${1:-30397}"

if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
  echo "Port must be numeric. Usage: ./dev.sh [port]" >&2
  exit 1
fi

echo "Serving nr-web at http://localhost:${PORT}"
python3 -m http.server "$PORT" --bind 127.0.0.1
