#!/bin/sh
set -eu

APP_ID="${APP_ID:-org.trustroots.nostroots}"
APP_READY_TIMEOUT_MS="${APP_READY_TIMEOUT_MS:-180000}"
BUNDLE_PREWARM_TIMEOUT_SECONDS="${BUNDLE_PREWARM_TIMEOUT_SECONDS:-180}"
DEV_CLIENT_SCHEME="${DEV_CLIENT_SCHEME:-exp+nr-app}"
DEV_CLIENT_MANIFEST_URL="${DEV_CLIENT_MANIFEST_URL:-http://10.0.2.2:8081?disableOnboarding=1}"
DEV_CLIENT_LAUNCH_WAIT_SECONDS="${DEV_CLIENT_LAUNCH_WAIT_SECONDS:-15}"
E2E_PREWARM_REQUIRED="${E2E_PREWARM_REQUIRED:-1}"
E2E_PREWARM_SCREEN_ID="${E2E_PREWARM_SCREEN_ID:-}"
E2E_PREWARM_ENABLED="${E2E_PREWARM_ENABLED:-1}"
LOG_DIR="${LOG_DIR:-.e2e-logs/android}"
METRO_PORT="${METRO_PORT:-8081}"
METRO_TIMEOUT_SECONDS="${METRO_TIMEOUT_SECONDS:-120}"
PRETEST_HIERARCHY_PATH="${PRETEST_HIERARCHY_PATH:-${LOG_DIR}/maestro-before-test.json}"
METRO_STARTED_BY_SCRIPT=0
LOCAL_FLOW_ROOT=""
LOCAL_FLOW_ARGS=""

mkdir -p "${LOG_DIR}"

export EXPO_PUBLIC_E2E=1
export EXPO_PUBLIC_NR_BRIDGE_BASE_URL="${EXPO_PUBLIC_NR_BRIDGE_BASE_URL:-http://10.0.2.2:8000}"
export EXPO_PUBLIC_NOSTR_RELAYS="${EXPO_PUBLIC_NOSTR_RELAYS:-ws://10.0.2.2:7777}"
export EXPO_DEBUG="${EXPO_DEBUG:-1}"

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ "$#" -eq 0 ]; then
  set -- .maestro
fi

metro_status() {
  curl -fsS "http://127.0.0.1:${METRO_PORT}/status" 2>/dev/null || true
}

is_metro_running() {
  case "$(metro_status)" in
    *packager-status:running*) return 0 ;;
    *) return 1 ;;
  esac
}

prewarm_metro_bundle() {
  echo "Prewarming Android bundle from Metro..."
  elapsed=0

  while [ "${elapsed}" -lt "${BUNDLE_PREWARM_TIMEOUT_SECONDS}" ]; do
    bundle_url="$(
      curl -fsS -H "Expo-Platform: android" "${MANIFEST_URL}" 2>/dev/null |
        MANIFEST_URL="${MANIFEST_URL}" python3 -c '
import json
import os
import sys
from urllib.parse import urljoin

manifest = json.load(sys.stdin)
bundle_url = manifest.get("launchAsset", {}).get("url", "")
print(urljoin(os.environ["MANIFEST_URL"], bundle_url) if bundle_url else "")
' 2>/dev/null || true
    )"

    if [ -n "${bundle_url}" ]; then
      echo "Fetching Android bundle: ${bundle_url}"
      if curl -fsS --max-time "${BUNDLE_PREWARM_TIMEOUT_SECONDS}" -o /dev/null "${bundle_url}"; then
        echo "Android bundle is prewarmed."
        return 0
      fi
    fi

    sleep 2
    elapsed=$((elapsed + 2))
  done

  echo "Timed out prewarming Android bundle from ${MANIFEST_URL}." >&2
  return 1
}

copy_local_flow_file() {
  source_file="$1"
  target_file="$2"

  # Expo dev-client stores the selected Metro project in app data. The shared
  # CI flows can launch/clear the bundled APK, but local dev-client flows must
  # keep the Metro project selected. A plain launchApp opens the dev launcher.
  awk '
    /^- launchApp:/ {
      skip_launch_app = 1
      next
    }
    skip_launch_app && /^[[:space:]]/ {
      next
    }
    {
      skip_launch_app = 0
      print
    }
  ' "${source_file}" >"${target_file}"
}

prepare_local_flows() {
  if [ -z "${LOCAL_FLOW_ROOT}" ]; then
    LOCAL_FLOW_ROOT="$(mktemp -d)"
  fi

  for flow_path in "$@"; do
    if [ -d "${flow_path}" ]; then
      target_dir="${LOCAL_FLOW_ROOT}/$(basename "${flow_path}")"
      mkdir -p "${target_dir}"

      copied_any=0
      for flow_file in "${flow_path}"/*.yaml "${flow_path}"/*.yml; do
        if [ -f "${flow_file}" ]; then
          copy_local_flow_file "${flow_file}" "${target_dir}/$(basename "${flow_file}")"
          copied_any=1
        fi
      done

      if [ "${copied_any}" = "0" ]; then
        echo "No Maestro YAML flows found in ${flow_path}." >&2
        exit 1
      fi

      LOCAL_FLOW_ARGS="${LOCAL_FLOW_ARGS} ${target_dir}"
    elif [ -f "${flow_path}" ]; then
      target_file="${LOCAL_FLOW_ROOT}/$(basename "${flow_path}")"
      copy_local_flow_file "${flow_path}" "${target_file}"
      LOCAL_FLOW_ARGS="${LOCAL_FLOW_ARGS} ${target_file}"
    else
      echo "Maestro flow path not found: ${flow_path}" >&2
      exit 1
    fi
  done
}

prewarm_app_bundle() {
  if [ -z "${LOCAL_FLOW_ROOT}" ]; then
    LOCAL_FLOW_ROOT="$(mktemp -d)"
  fi

  prewarm_flow="${LOCAL_FLOW_ROOT}/prewarm.yaml"
  {
    echo "appId: ${APP_ID}"
    echo "---"
    echo "- openLink: \"nostroots://e2e/reset\""
    echo "- runFlow:"
    echo "    when:"
    echo "      visible: \"Open\""
    echo "    commands:"
    echo "      - tapOn: \"Open\""
    echo "- runFlow:"
    echo "    when:"
    echo "      visible: \"Open\""
    echo "    commands:"
    echo "      - tapOn: \"Open\""
    if [ -n "${E2E_PREWARM_SCREEN_ID}" ]; then
      echo "- extendedWaitUntil:"
      echo "    visible:"
      echo "      id: \"${E2E_PREWARM_SCREEN_ID}\""
      echo "    timeout: ${APP_READY_TIMEOUT_MS}"
    fi
  } >"${prewarm_flow}"

  if [ -n "${E2E_PREWARM_SCREEN_ID}" ]; then
    echo "Prewarming app bundle and waiting for ${E2E_PREWARM_SCREEN_ID}..."
  else
    echo "Prewarming app bundle without explicit readiness check..."
  fi
  if [ -n "${MAESTRO_HOST:-}" ]; then
    maestro --host "${MAESTRO_HOST}" test "${prewarm_flow}"
  else
    maestro test "${prewarm_flow}"
  fi
}

capture_hierarchy() {
  hierarchy_path="$1"
  echo "Capturing Maestro hierarchy to ${hierarchy_path}..."
  if [ -n "${MAESTRO_HOST:-}" ]; then
    if maestro --host "${MAESTRO_HOST}" hierarchy >"${hierarchy_path}"; then
      echo "Saved Maestro hierarchy to ${hierarchy_path}"
    else
      echo "Unable to capture pre-test hierarchy with MAESTRO_HOST=${MAESTRO_HOST}." >&2
    fi
  else
    if maestro hierarchy >"${hierarchy_path}"; then
      echo "Saved Maestro hierarchy to ${hierarchy_path}"
    else
      echo "Unable to capture pre-test hierarchy." >&2
    fi
  fi
}

capture_pretest_hierarchy() {
  capture_hierarchy "${PRETEST_HIERARCHY_PATH}"
}

cleanup() {
  if [ "${METRO_STARTED_BY_SCRIPT}" = "1" ] && [ -n "${METRO_PID:-}" ]; then
    echo "Stopping Metro started by this script..."
    kill "${METRO_PID}" 2>/dev/null || true
    wait "${METRO_PID}" 2>/dev/null || true
  fi
  if [ -n "${LOCAL_FLOW_ROOT}" ] && [ -d "${LOCAL_FLOW_ROOT}" ]; then
    rm -rf "${LOCAL_FLOW_ROOT}"
  fi
}

trap cleanup EXIT INT TERM

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found. Add Android platform-tools to PATH first." >&2
  exit 1
fi

if ! command -v maestro >/dev/null 2>&1; then
  echo "maestro not found. Install Maestro or add it to PATH first." >&2
  exit 1
fi

echo "Checking Android device and app package..."
adb devices -l
if ! adb shell pm path "${APP_ID}" >/dev/null; then
  echo "${APP_ID} is not installed. Run pnpm run android:e2e:install from the host first." >&2
  exit 1
fi

echo "Forwarding emulator localhost:${METRO_PORT} to Metro..."
adb reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}"

if is_metro_running; then
  echo "Metro already running on ${METRO_PORT}; reusing it."
  echo "Ensure the existing Metro was started with EXPO_PUBLIC_E2E=1."
else
  echo "Starting Metro on ${METRO_PORT}..."
  pnpm exec expo start --dev-client --clear --port "${METRO_PORT}" &
  METRO_PID=$!
  METRO_STARTED_BY_SCRIPT=1
fi

echo "Waiting for Metro..."
elapsed=0
while ! is_metro_running; do
  if [ "${elapsed}" -ge "${METRO_TIMEOUT_SECONDS}" ]; then
    echo "Metro did not become ready within ${METRO_TIMEOUT_SECONDS}s." >&2
    exit 1
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done

MANIFEST_URL="${MANIFEST_URL:-http://127.0.0.1:${METRO_PORT}}"
prewarm_metro_bundle

ENCODED_MANIFEST_URL="$(
  DEV_CLIENT_MANIFEST_URL="${DEV_CLIENT_MANIFEST_URL}" python3 -c '
import os
from urllib.parse import quote

print(quote(os.environ["DEV_CLIENT_MANIFEST_URL"], safe=""))
'
)"
DEV_CLIENT_URL="${DEV_CLIENT_URL:-${DEV_CLIENT_SCHEME}://expo-development-client/?url=${ENCODED_MANIFEST_URL}}"
echo "Dev client URL: ${DEV_CLIENT_URL}"
echo "Intent handlers:"
adb shell pm query-intent-activities \
  -a android.intent.action.VIEW \
  -d "${DEV_CLIENT_URL}" || true

echo "Launching development client..."
adb shell am force-stop "${APP_ID}" || true
adb shell am start -W \
  -a android.intent.action.VIEW \
  -d "${DEV_CLIENT_URL}" \
  -p "${APP_ID}"

echo "Waiting ${DEV_CLIENT_LAUNCH_WAIT_SECONDS}s after launching development client..."
sleep "${DEV_CLIENT_LAUNCH_WAIT_SECONDS}"
capture_pretest_hierarchy

echo "Running Maestro..."
if [ "${E2E_PREWARM_ENABLED}" = "1" ]; then
  if ! prewarm_app_bundle; then
    capture_hierarchy "${LOG_DIR}/maestro-after-prewarm-failure.json"
    if [ "${E2E_PREWARM_REQUIRED}" != "1" ]; then
      echo "Prewarm failed, but continuing due E2E_PREWARM_REQUIRED=${E2E_PREWARM_REQUIRED}."
    else
      exit 1
    fi
  fi
else
  echo "Skipping Maestro prewarm for this run (E2E_PREWARM_ENABLED=${E2E_PREWARM_ENABLED})."
fi
prepare_local_flows "$@"
if [ -n "${MAESTRO_HOST:-}" ]; then
  # LOCAL_FLOW_ARGS is generated from temporary paths without whitespace.
  # shellcheck disable=SC2086
  maestro --host "${MAESTRO_HOST}" test ${LOCAL_FLOW_ARGS}
else
  # LOCAL_FLOW_ARGS is generated from temporary paths without whitespace.
  # shellcheck disable=SC2086
  maestro test ${LOCAL_FLOW_ARGS}
fi
