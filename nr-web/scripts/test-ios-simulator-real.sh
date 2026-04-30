#!/usr/bin/env bash
set -euo pipefail

SIMULATOR_DEVICE="${IOS_SIMULATOR_DEVICE:-iPhone 17 Pro}"
APPIUM_HOST="${APPIUM_HOST:-127.0.0.1}"
APPIUM_PORT="${APPIUM_PORT:-4725}"
APPIUM_HOST_URL="${APPIUM_URL:-http://${APPIUM_HOST}:${APPIUM_PORT}}"
STATIC_PORT="${STATIC_PORT:-8080}"
SIM_BASE_URL="${SIM_BASE_URL:-http://127.0.0.1:${STATIC_PORT}}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export APPIUM_HOME="${APPIUM_HOME:-$HOME/.appium}"

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun not found. Install Xcode Command Line Tools."
  exit 1
fi

if ! command -v appium >/dev/null 2>&1; then
  echo "appium binary not found. Install Appium on host (example: brew install appium)."
  exit 1
fi

if ! command -v docker-compose >/dev/null 2>&1; then
  echo "docker-compose not found."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found."
  exit 1
fi

UDID="$(xcrun simctl list devices available -j | node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(0, 'utf8'));
const wanted = process.argv[1];
for (const runtime of Object.values(data.devices || {})) {
  for (const d of runtime) {
    if (d.isAvailable && d.name === wanted) {
      process.stdout.write(d.udid);
      process.exit(0);
    }
  }
}
process.exit(1);
" "$SIMULATOR_DEVICE" || true)"

if [ -z "$UDID" ]; then
  echo "Could not find available simulator named: $SIMULATOR_DEVICE"
  exit 1
fi

IOS_PLATFORM_VERSION="$(xcrun simctl list devices available -j | node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(0, 'utf8'));
const udid = process.argv[1];
for (const [runtime, devices] of Object.entries(data.devices || {})) {
  for (const d of devices) {
    if (d.udid === udid) {
      const m = runtime.match(/iOS-(\\d+)-(\\d+)/);
      if (m) {
        process.stdout.write(m[1] + '.' + m[2]);
        process.exit(0);
      }
    }
  }
}
process.exit(1);
" "$UDID" || true)"

if [ -z "$IOS_PLATFORM_VERSION" ]; then
  IOS_PLATFORM_VERSION="26.4"
fi

echo "Using simulator: $SIMULATOR_DEVICE ($UDID), iOS ${IOS_PLATFORM_VERSION}"
xcrun simctl boot "$UDID" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$UDID" -b
open -a Simulator --args -CurrentDeviceUDID "$UDID" >/dev/null 2>&1 || true

cleanup() {
  if [ -n "${STATIC_SERVER_PID:-}" ]; then
    kill "$STATIC_SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "${APPIUM_PID:-}" ]; then
    kill "$APPIUM_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

python3 -m http.server "$STATIC_PORT" --directory "$PROJECT_ROOT" >/tmp/nr-web-ios-static.log 2>&1 &
STATIC_SERVER_PID=$!

if ! curl -fsS "http://127.0.0.1:${STATIC_PORT}" >/dev/null 2>&1; then
  sleep 1
fi

if ! appium driver list --installed --json 2>/dev/null | node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(0, 'utf8'));
process.exit(data && data.xcuitest ? 0 : 1);
"; then
  echo "Installing Appium XCUITest driver..."
  appium driver install xcuitest
fi

if curl -fsS "${APPIUM_HOST_URL}/status" >/dev/null 2>&1; then
  echo "Appium already running at ${APPIUM_HOST_URL}; reusing it."
else
  appium --base-path / --address "$APPIUM_HOST" --port "$APPIUM_PORT" --log-level info >/tmp/nr-web-ios-appium.log 2>&1 &
  APPIUM_PID=$!
  for _ in $(seq 1 30); do
    if curl -fsS "${APPIUM_HOST_URL}/status" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

if ! curl -fsS "${APPIUM_HOST_URL}/status" >/dev/null 2>&1; then
  echo "Appium did not start correctly at ${APPIUM_HOST_URL}"
  echo "Check /tmp/nr-web-ios-appium.log"
  exit 1
fi

cd "$PROJECT_ROOT"
docker-compose run --rm \
  -e APPIUM_URL="http://host.docker.internal:${APPIUM_PORT}" \
  -e BASE_URL="${SIM_BASE_URL}" \
  -e IOS_DEVICE_NAME="$SIMULATOR_DEVICE" \
  -e IOS_PLATFORM_VERSION="$IOS_PLATFORM_VERSION" \
  -e IOS_UDID="$UDID" \
  tests \
  node tests/ios-sim/webdriver-smoke.mjs || {
    echo ""
    echo "Appium log tail (/tmp/nr-web-ios-appium.log):"
    tail -n 120 /tmp/nr-web-ios-appium.log || true
    exit 1
  }
