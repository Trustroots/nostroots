#!/bin/sh
set -eu

AVD_NAME="${AVD_NAME:-Pixel_10_Pro}"
ADB_PORT="${ADB_PORT:-5037}"
BOOT_TIMEOUT_SECONDS="${BOOT_TIMEOUT_SECONDS:-180}"
DEVICE_TIMEOUT_SECONDS="${DEVICE_TIMEOUT_SECONDS:-90}"
EMULATOR_EXTRA_ARGS="${EMULATOR_EXTRA_ARGS:-}"
LOG_DIR="${LOG_DIR:-.e2e-logs/android}"
METRO_PORT="${METRO_PORT:-8081}"
WIPE_DATA="${WIPE_DATA:-0}"
LOG_AVD_NAME="$(printf '%s' "${AVD_NAME}" | tr -c 'A-Za-z0-9_.-' '_')"
EMULATOR_LOG="${LOG_DIR}/emulator-${LOG_AVD_NAME}.log"
DEVICE_STATE_LOG="${LOG_DIR}/device-state-${LOG_AVD_NAME}.txt"
LOGCAT_BOOT_LOG="${LOG_DIR}/logcat-boot-${LOG_AVD_NAME}.txt"

mkdir -p "${LOG_DIR}"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found. Add Android platform-tools to PATH first." >&2
  exit 1
fi

if ! command -v emulator >/dev/null 2>&1; then
  echo "emulator not found. Add Android SDK emulator tools to PATH first." >&2
  exit 1
fi

if ! emulator -list-avds | grep -qx "${AVD_NAME}"; then
  echo "AVD '${AVD_NAME}' not found. Available AVDs:" >&2
  emulator -list-avds >&2
  exit 1
fi

echo "Stopping existing Android emulator/device sessions..."
adb devices | awk 'NR > 1 && $2 == "device" { print $1 }' | while read -r device_id; do
  if [ -n "${device_id}" ]; then
    echo "Stopping ${device_id}..."
    adb -s "${device_id}" emu kill >/dev/null 2>&1 || true
  fi
done

echo "Restarting host ADB server on all interfaces at port ${ADB_PORT}..."
adb kill-server >/dev/null 2>&1 || true
adb -a -P "${ADB_PORT}" start-server

emulator_args="-avd ${AVD_NAME} -no-snapshot-load -no-boot-anim"
if [ "${WIPE_DATA}" = "1" ]; then
  emulator_args="${emulator_args} -wipe-data"
fi
if [ -n "${EMULATOR_EXTRA_ARGS}" ]; then
  emulator_args="${emulator_args} ${EMULATOR_EXTRA_ARGS}"
fi

echo "Starting emulator '${AVD_NAME}'..."
# shellcheck disable=SC2086
emulator ${emulator_args} >"${EMULATOR_LOG}" 2>&1 &
EMULATOR_PID=$!
echo "Emulator process ${EMULATOR_PID}; log: ${EMULATOR_LOG}"

echo "Waiting for device..."
elapsed=0
device_found=""
while [ -z "${device_found}" ]; do
  if ! kill -0 "${EMULATOR_PID}" 2>/dev/null; then
    echo "Emulator process exited before ADB detected a device." >&2
    echo "Emulator log:" >&2
    tail -n 120 "${EMULATOR_LOG}" >&2 || true
    exit 1
  fi

  device_found="$(adb devices | awk 'NR > 1 && $2 ~ /device|offline/ { print $1; exit }')"
  if [ -n "${device_found}" ]; then
    break
  fi

  if [ "${elapsed}" -ge "${DEVICE_TIMEOUT_SECONDS}" ]; then
    echo "ADB did not detect an emulator within ${DEVICE_TIMEOUT_SECONDS}s." >&2
    echo "Emulator log:" >&2
    tail -n 120 "${EMULATOR_LOG}" >&2 || true
    exit 1
  fi

  sleep 2
  elapsed=$((elapsed + 2))
done
echo "Detected device ${device_found}."

echo "Waiting for Android boot to complete..."
elapsed=0
boot_completed=""
while [ "${boot_completed}" != "1" ]; do
  boot_completed="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  if [ "${boot_completed}" = "1" ]; then
    break
  fi

  if [ "${elapsed}" -ge "${BOOT_TIMEOUT_SECONDS}" ]; then
    echo "Emulator did not finish booting within ${BOOT_TIMEOUT_SECONDS}s." >&2
    echo "Last emulator log lines:" >&2
    tail -n 80 "${EMULATOR_LOG}" >&2 || true
    exit 1
  fi

  sleep 2
  elapsed=$((elapsed + 2))
done

echo "Unlocking emulator..."
adb shell input keyevent 82 >/dev/null 2>&1 || true

echo "Forwarding emulator localhost:${METRO_PORT} to host localhost:${METRO_PORT}..."
adb reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}" || true

{
  echo "adb devices -l"
  adb devices -l
  echo
  echo "sys.boot_completed=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  echo
  echo "Current focused window:"
  adb shell dumpsys window 2>/dev/null | awk '/mCurrentFocus|mFocusedApp/ { print }' || true
} | tee "${DEVICE_STATE_LOG}"

adb logcat -d -t 1000 >"${LOGCAT_BOOT_LOG}" 2>/dev/null || true
echo "Device state log: ${DEVICE_STATE_LOG}"
echo "Boot logcat: ${LOGCAT_BOOT_LOG}"
echo "Emulator '${AVD_NAME}' is ready."
