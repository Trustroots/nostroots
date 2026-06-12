#!/bin/sh
set -eu

ADB_PORT="${ADB_PORT:-5037}"
METRO_PORT="${METRO_PORT:-8081}"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found. Add Android platform-tools to PATH first." >&2
  exit 1
fi

echo "Restarting host ADB server on all interfaces at port ${ADB_PORT}..."
adb kill-server >/dev/null 2>&1 || true
adb -a -P "${ADB_PORT}" start-server

echo "Waiting for an Android emulator or device..."
adb wait-for-device

echo "Waiting for Android boot to complete..."
boot_completed=""
while [ "${boot_completed}" != "1" ]; do
  boot_completed="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  if [ "${boot_completed}" != "1" ]; then
    sleep 2
  fi
done

echo "Forwarding emulator localhost:${METRO_PORT} to host localhost:${METRO_PORT}..."
adb reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}"

adb devices -l
