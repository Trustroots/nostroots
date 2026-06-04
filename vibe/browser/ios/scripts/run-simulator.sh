#!/usr/bin/env bash
# Build Nostroots Browser (incrementally) and run it in the iOS Simulator.
#
# Optional env:
#   SIMULATOR_NAME   default: iPhone 17
#   SIMULATOR_OS     e.g. 26.5 (omit to let Xcode pick a matching runtime)
#   SIMULATOR_UDID   skip name lookup when set
#   DERIVED_DATA     default: vibe/browser/ios/.build/simulator
#   CLEAN_BUILD      set to 1 to remove derived data before building
#   SKIP_BUILD       set to 1 to install/launch an existing simulator build

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ios_dir="$(cd "${script_dir}/.." && pwd)"

scheme="NostrootsBrowser"
app_bundle_name="Nostroots Browser.app"
bundle_id="org.trustroots.nostroots.browser"
derived_data="${DERIVED_DATA:-${ios_dir}/.build/simulator}"
simulator_name="${SIMULATOR_NAME:-iPhone 17}"

extract_simulator_udid() {
  local line="$1"
  if [[ "$line" =~ \(([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})\) ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
  fi
}

simulator_destination() {
  if [[ -n "${SIMULATOR_OS:-}" ]]; then
    printf 'platform=iOS Simulator,name=%s,OS=%s' "$simulator_name" "$SIMULATOR_OS"
  else
    printf 'platform=iOS Simulator,name=%s' "$simulator_name"
  fi
}

simulator_udid() {
  if [[ -n "${SIMULATOR_UDID:-}" ]]; then
    printf '%s' "$SIMULATOR_UDID"
    return
  fi

  local line udid
  line="$(
    xcrun simctl list devices available 2>/dev/null \
      | grep -F "${simulator_name} (" \
      | grep -v unavailable \
      | head -1
  )"
  if [[ -z "$line" ]]; then
    echo "error: no available simulator named '${simulator_name}'" >&2
    echo "hint: run 'xcrun simctl list devices available' or set SIMULATOR_NAME" >&2
    exit 1
  fi

  udid="$(extract_simulator_udid "$line")"
  if [[ -z "$udid" ]]; then
    echo "error: could not parse simulator UDID for '${simulator_name}'" >&2
    exit 1
  fi
  printf '%s' "$udid"
}

open_simulator_app() {
  local udid="$1"
  if [[ -d "/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app" ]]; then
    open "/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app" --args -CurrentDeviceUDID "$udid"
  else
    open -a Simulator --args -CurrentDeviceUDID "$udid"
  fi
}

boot_simulator() {
  local udid="$1"
  xcrun simctl boot "$udid" 2>/dev/null || true
  open_simulator_app "$udid"
}

destination="$(simulator_destination)"
udid="$(simulator_udid)"
app_path="${derived_data}/Build/Products/Debug-iphonesimulator/${app_bundle_name}"

if [[ "${CLEAN_BUILD:-0}" == "1" ]]; then
  echo "Removing ${derived_data}..."
  rm -rf "$derived_data"
fi

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "Building ${scheme} for simulator (${destination})..."
  xcodebuild \
    -project "${ios_dir}/NostrootsBrowser.xcodeproj" \
    -scheme "$scheme" \
    -configuration Debug \
    -sdk iphonesimulator \
    -derivedDataPath "$derived_data" \
    -destination "$destination" \
    build
fi

if [[ ! -d "$app_path" ]]; then
  echo "error: built app not found at ${app_path}" >&2
  echo "hint: run without SKIP_BUILD=1 to build first" >&2
  exit 1
fi

echo "Booting simulator ${simulator_name} (${udid})..."
boot_simulator "$udid"
sleep 2

echo "Installing ${app_bundle_name}..."
xcrun simctl install "$udid" "$app_path"

echo "Launching ${bundle_id}..."
xcrun simctl launch "$udid" "$bundle_id"

echo "Done. ${scheme} should be open in Simulator."
