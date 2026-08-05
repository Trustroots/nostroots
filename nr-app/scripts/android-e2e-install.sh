#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="${LOG_DIR:-.e2e-logs/android}"
REACT_NATIVE_ARCHITECTURES="${REACT_NATIVE_ARCHITECTURES:-x86_64}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="${LOG_DIR}/install-${TIMESTAMP}.log"
LATEST_LOG="${LOG_DIR}/install-latest.log"

mkdir -p "${LOG_DIR}"

export EXPO_PUBLIC_E2E=1
export EXPO_PUBLIC_NR_BRIDGE_BASE_URL="${EXPO_PUBLIC_NR_BRIDGE_BASE_URL:-http://10.0.2.2:8000}"
export EXPO_PUBLIC_NOSTR_RELAYS="${EXPO_PUBLIC_NOSTR_RELAYS:-ws://10.0.2.2:7777}"
export SENTRY_DISABLE_AUTO_UPLOAD="${SENTRY_DISABLE_AUTO_UPLOAD:-true}"

{
  echo "Writing Android E2E install log to ${LOG_FILE}"
  echo "Started at $(date)"
  echo
  echo "EXPO_PUBLIC_E2E=${EXPO_PUBLIC_E2E}"
  echo "EXPO_PUBLIC_NR_BRIDGE_BASE_URL=${EXPO_PUBLIC_NR_BRIDGE_BASE_URL}"
  echo "EXPO_PUBLIC_NOSTR_RELAYS=${EXPO_PUBLIC_NOSTR_RELAYS}"
  echo "REACT_NATIVE_ARCHITECTURES=${REACT_NATIVE_ARCHITECTURES}"
  echo "SENTRY_DISABLE_AUTO_UPLOAD=${SENTRY_DISABLE_AUTO_UPLOAD}"
  echo
  echo "Building Android debug APK without launching the app..."
  (
    cd android
    ./gradlew app:assembleDebug \
      -x lint \
      -x test \
      --configure-on-demand \
      --build-cache \
      -PreactNativeDevServerPort=8081 \
      -PreactNativeArchitectures="${REACT_NATIVE_ARCHITECTURES}"
  )
  echo
  echo "Installing Android debug APK without launching the app..."
  adb install -r android/app/build/outputs/apk/debug/app-debug.apk
} 2>&1 | tee "${LOG_FILE}"

status="${PIPESTATUS[0]}"
cp "${LOG_FILE}" "${LATEST_LOG}"
echo "Latest Android E2E install log: ${LATEST_LOG}"
exit "${status}"
