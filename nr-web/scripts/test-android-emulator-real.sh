#!/usr/bin/env bash
set -euo pipefail

ANDROID_AVD_NAME="${ANDROID_AVD_NAME:-Medium_Phone_API_35}"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/Users/k/Library/Android/sdk}"
ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
# Normalize common host setups where ANDROID_HOME points to ~/Library/Android
# while actual SDK lives in ~/Library/Android/sdk.
if [ ! -d "${ANDROID_HOME}/build-tools" ] && [ -d "${ANDROID_HOME}/sdk/build-tools" ]; then
  ANDROID_HOME="${ANDROID_HOME}/sdk"
fi
if [ ! -d "${ANDROID_SDK_ROOT}/build-tools" ] && [ -d "${ANDROID_SDK_ROOT}/sdk/build-tools" ]; then
  ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT}/sdk"
fi
ANDROID_EMULATOR_BIN="${ANDROID_EMULATOR_BIN:-${ANDROID_SDK_ROOT}/emulator/emulator}"
ADB_BIN="${ADB_BIN:-${ANDROID_SDK_ROOT}/platform-tools/adb}"
APPIUM_HOST="${APPIUM_HOST:-127.0.0.1}"
APPIUM_PORT="${APPIUM_PORT:-4726}"
APPIUM_HOST_URL="${APPIUM_URL:-http://${APPIUM_HOST}:${APPIUM_PORT}}"
STATIC_PORT="${STATIC_PORT:-8080}"
EMULATOR_BASE_URL="${EMULATOR_BASE_URL:-http://10.0.2.2:${STATIC_PORT}}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export APPIUM_HOME="${APPIUM_HOME:-$HOME/.appium}"
export ANDROID_HOME
export ANDROID_SDK_ROOT
ANDROID_SERIAL="${ANDROID_SERIAL:-emulator-5554}"

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
if [ ! -x "$ANDROID_EMULATOR_BIN" ]; then
  echo "Android emulator binary not found at: $ANDROID_EMULATOR_BIN"
  exit 1
fi
if [ ! -x "$ADB_BIN" ]; then
  echo "adb binary not found at: $ADB_BIN"
  exit 1
fi

cleanup() {
  if [ -n "${STATIC_SERVER_PID:-}" ]; then
    kill "$STATIC_SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "${APPIUM_PID:-}" ]; then
    kill "$APPIUM_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

"$ADB_BIN" start-server >/dev/null 2>&1 || true

if ! "$ADB_BIN" devices | rg -q "^${ANDROID_SERIAL}[[:space:]]+device$"; then
  "$ANDROID_EMULATOR_BIN" -avd "$ANDROID_AVD_NAME" -no-snapshot-load >/tmp/nr-web-android-emulator.log 2>&1 &
  EMULATOR_PID=$!
  echo "Started Android emulator AVD: ${ANDROID_AVD_NAME}"
fi

for _ in $(seq 1 120); do
  if "$ADB_BIN" devices | rg -q "^${ANDROID_SERIAL}[[:space:]]+device$"; then
    break
  fi
  sleep 2
done

if ! "$ADB_BIN" devices | rg -q "^${ANDROID_SERIAL}[[:space:]]+device$"; then
  echo "Android emulator did not appear as ${ANDROID_SERIAL}"
  echo "Check /tmp/nr-web-android-emulator.log"
  exit 1
fi

echo "Waiting for Android emulator boot completion..."
for _ in $(seq 1 120); do
  BOOTED="$("$ADB_BIN" -s "$ANDROID_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
  if [ "$BOOTED" = "1" ]; then
    break
  fi
  sleep 2
done

BOOTED="$("$ADB_BIN" -s "$ANDROID_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
if [ "$BOOTED" != "1" ]; then
  echo "Android emulator did not finish booting."
  exit 1
fi

ANDROID_PLATFORM_VERSION="$("$ADB_BIN" -s "$ANDROID_SERIAL" shell getprop ro.build.version.release 2>/dev/null | tr -d '\r')"

python3 -m http.server "$STATIC_PORT" --directory "$PROJECT_ROOT" >/tmp/nr-web-android-static.log 2>&1 &
STATIC_SERVER_PID=$!
sleep 1

if ! appium driver list --installed --json 2>/dev/null | node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(0, 'utf8'));
process.exit(data && data.uiautomator2 ? 0 : 1);
"; then
  echo "Installing Appium UiAutomator2 driver..."
  appium driver install uiautomator2
fi

# Restart Appium on dedicated port so it always picks correct SDK env.
if lsof -ti tcp:"$APPIUM_PORT" >/dev/null 2>&1; then
  kill "$(lsof -ti tcp:"$APPIUM_PORT")" >/dev/null 2>&1 || true
  sleep 1
fi

  appium --base-path / --address "$APPIUM_HOST" --port "$APPIUM_PORT" --allow-insecure chromedriver_autodownload --log-level info >/tmp/nr-web-android-appium.log 2>&1 &
APPIUM_PID=$!
for _ in $(seq 1 30); do
  if curl -fsS "${APPIUM_HOST_URL}/status" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "${APPIUM_HOST_URL}/status" >/dev/null 2>&1; then
  echo "Appium did not start correctly at ${APPIUM_HOST_URL}"
  echo "Check /tmp/nr-web-android-appium.log"
  exit 1
fi

cd "$PROJECT_ROOT"
docker-compose run --rm \
  -e APPIUM_URL="http://host.docker.internal:${APPIUM_PORT}" \
  -e BASE_URL="${EMULATOR_BASE_URL}" \
  -e ANDROID_DEVICE_NAME="$ANDROID_AVD_NAME" \
  -e ANDROID_PLATFORM_VERSION="$ANDROID_PLATFORM_VERSION" \
  -e ANDROID_UDID="$ANDROID_SERIAL" \
  tests \
  node tests/android-sim/webdriver-smoke.mjs || {
    echo ""
    echo "Appium log tail (/tmp/nr-web-android-appium.log):"
    tail -n 120 /tmp/nr-web-android-appium.log || true
    exit 1
  }
