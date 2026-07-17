#!/usr/bin/env bash
set -euo pipefail

APP_ID="${APP_ID:-org.trustroots.nostroots}"
BUILD_ROOT="${BUILD_ROOT:-.e2e-logs/ios/build}"
CONFIGURATION="${IOS_CONFIGURATION:-Debug}"
DERIVED_DATA_PATH="${DERIVED_DATA_PATH:-${BUILD_ROOT}/DerivedData}"
LOG_DIR="${LOG_DIR:-.e2e-logs/ios}"
SCHEME="${IOS_SCHEME:-Nostroots}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="${LOG_DIR}/build-${TIMESTAMP}.log"
LATEST_LOG="${LOG_DIR}/build-latest.log"

mkdir -p "${LOG_DIR}" "${BUILD_ROOT}"

export EXPO_PUBLIC_E2E=1
export EXPO_PUBLIC_NR_BRIDGE_BASE_URL="${EXPO_PUBLIC_NR_BRIDGE_BASE_URL:-http://127.0.0.1:8000}"
export EXPO_PUBLIC_NOSTR_RELAYS="${EXPO_PUBLIC_NOSTR_RELAYS:-ws://127.0.0.1:7777}"
export REACT_NATIVE_PACKAGER_HOSTNAME="${REACT_NATIVE_PACKAGER_HOSTNAME:-localhost}"
export SENTRY_DISABLE_AUTO_UPLOAD="${SENTRY_DISABLE_AUTO_UPLOAD:-true}"

{
  echo "Writing iOS E2E build log to ${LOG_FILE}"
  echo "Started at $(date)"
  echo
  echo "APP_ID=${APP_ID}"
  echo "EXPO_PUBLIC_E2E=${EXPO_PUBLIC_E2E}"
  echo "EXPO_PUBLIC_NR_BRIDGE_BASE_URL=${EXPO_PUBLIC_NR_BRIDGE_BASE_URL}"
  echo "EXPO_PUBLIC_NOSTR_RELAYS=${EXPO_PUBLIC_NOSTR_RELAYS}"
  echo "REACT_NATIVE_PACKAGER_HOSTNAME=${REACT_NATIVE_PACKAGER_HOSTNAME}"
  echo "SENTRY_DISABLE_AUTO_UPLOAD=${SENTRY_DISABLE_AUTO_UPLOAD}"
  echo

  echo "Ensuring an iPhone simulator is booted..."
  simulator_output="$(bash ./scripts/ios-e2e-simulator-reset.sh)"
  echo "${simulator_output}"
  SIMULATOR_UDID="$(printf '%s\n' "${simulator_output}" | awk -F '=' '/^IOS_SIMULATOR_UDID=/ { print $2 }' | tail -1)"
  if [ -z "${SIMULATOR_UDID}" ]; then
    echo "Unable to determine booted iOS simulator UDID." >&2
    exit 1
  fi
  echo

  echo "Regenerating iOS native project for E2E..."
  pnpm exec expo prebuild --platform ios --clean
  echo

  echo "Building iOS simulator app with xcodebuild..."
  xcodebuild \
    -workspace ios/Nostroots.xcworkspace \
    -scheme "${SCHEME}" \
    -configuration "${CONFIGURATION}" \
    -sdk iphonesimulator \
    -destination "id=${SIMULATOR_UDID}" \
    -derivedDataPath "${DERIVED_DATA_PATH}" \
    CODE_SIGNING_ALLOWED=NO \
    build
  echo

  APP_PATH="$(find "${DERIVED_DATA_PATH}/Build/Products/${CONFIGURATION}-iphonesimulator" -maxdepth 1 -name "*.app" -type d | head -1)"
  if [ -z "${APP_PATH}" ]; then
    echo "Unable to find built .app under ${DERIVED_DATA_PATH}/Build/Products/${CONFIGURATION}-iphonesimulator." >&2
    exit 1
  fi

  echo "Installing iOS simulator app: ${APP_PATH}"
  xcrun simctl uninstall "${SIMULATOR_UDID}" "${APP_ID}" >/dev/null 2>&1 || true
  xcrun simctl install "${SIMULATOR_UDID}" "${APP_PATH}"
  xcrun simctl get_app_container "${SIMULATOR_UDID}" "${APP_ID}" app
  echo "iOS E2E app installed on ${SIMULATOR_UDID}."
} 2>&1 | tee "${LOG_FILE}"

status="${PIPESTATUS[0]}"
cp "${LOG_FILE}" "${LATEST_LOG}"
echo "Latest iOS E2E build log: ${LATEST_LOG}"
exit "${status}"
