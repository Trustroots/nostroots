#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="${LOG_DIR:-.e2e-logs/android}"
REACT_NATIVE_ARCHITECTURES="${REACT_NATIVE_ARCHITECTURES:-x86_64}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="${LOG_DIR}/build-${TIMESTAMP}.log"
LATEST_LOG="${LOG_DIR}/build-latest.log"
APK_SOURCE="android/app/build/outputs/apk/debug/app-debug.apk"
APK_TARGET="builds/app-e2e-debug.apk"

mkdir -p "${LOG_DIR}" builds

export EXPO_PUBLIC_E2E=1
export EXPO_PUBLIC_NR_BRIDGE_BASE_URL="${EXPO_PUBLIC_NR_BRIDGE_BASE_URL:-http://10.0.2.2:8000}"
export EXPO_PUBLIC_NOSTR_RELAYS="${EXPO_PUBLIC_NOSTR_RELAYS:-ws://10.0.2.2:7777}"
export SENTRY_DISABLE_AUTO_UPLOAD="${SENTRY_DISABLE_AUTO_UPLOAD:-true}"

{
  echo "Writing Android E2E build log to ${LOG_FILE}"
  echo "Started at $(date)"
  echo
  echo "EXPO_PUBLIC_E2E=${EXPO_PUBLIC_E2E}"
  echo "EXPO_PUBLIC_NR_BRIDGE_BASE_URL=${EXPO_PUBLIC_NR_BRIDGE_BASE_URL}"
  echo "EXPO_PUBLIC_NOSTR_RELAYS=${EXPO_PUBLIC_NOSTR_RELAYS}"
  echo "REACT_NATIVE_ARCHITECTURES=${REACT_NATIVE_ARCHITECTURES}"
  echo "E2E_REUSE_PREBUILD=${E2E_REUSE_PREBUILD:-0}"
  echo "SENTRY_DISABLE_AUTO_UPLOAD=${SENTRY_DISABLE_AUTO_UPLOAD}"
  echo
  if [ "${E2E_REUSE_PREBUILD:-0}" = "1" ] && [ -f android/settings.gradle ]; then
    echo "Refreshing cached Android native project for E2E..."
    pnpm exec expo prebuild --platform android --no-install
  else
    echo "Regenerating Android native project for E2E..."
    pnpm exec expo prebuild --platform android --clean --no-install
  fi
  echo
  echo "Building Android debug APK with Gradle..."
  (
    cd android
    ./gradlew app:assembleDebug \
      -x lint \
      -x test \
      --configure-on-demand \
      --build-cache \
      --parallel \
      -PreactNativeDevServerPort=8081 \
      -PreactNativeArchitectures="${REACT_NATIVE_ARCHITECTURES}"
  )
  echo
  cp "${APK_SOURCE}" "${APK_TARGET}"
  unzip -t "${APK_TARGET}" >/dev/null
  echo "Android E2E APK: ${APK_TARGET}"
} 2>&1 | tee "${LOG_FILE}"

status="${PIPESTATUS[0]}"
cp "${LOG_FILE}" "${LATEST_LOG}"
echo "Latest Android E2E build log: ${LATEST_LOG}"
exit "${status}"
