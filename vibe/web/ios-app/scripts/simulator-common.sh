#!/usr/bin/env bash
# Shared helpers for vibe/web/ios-app simulator launch scripts.

set -euo pipefail

ios_app_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
project_path="${ios_app_dir}/NostrootsNative.xcodeproj"

simulator_name() {
  printf '%s' "${SIMULATOR_NAME:-iPhone 17 Pro}"
}

simulator_destination() {
  local name
  name="$(simulator_name)"
  if [[ -n "${SIMULATOR_OS:-}" ]]; then
    printf 'platform=iOS Simulator,name=%s,OS=%s' "$name" "$SIMULATOR_OS"
  else
    printf 'platform=iOS Simulator,name=%s' "$name"
  fi
}

simulator_udid() {
  local name udid
  name="$(simulator_name)"
  udid="$(
    xcrun simctl list devices available 2>/dev/null \
      | grep -F "${name} (" \
      | grep -v unavailable \
      | head -1 \
      | sed -nE 's/.*\(([0-9A-Fa-f-]{36})\).*/\1/p'
  )"
  if [[ -z "$udid" ]]; then
    echo "error: no available simulator named '${name}'" >&2
    echo "hint: run 'xcrun simctl list devices available' or set SIMULATOR_NAME" >&2
    return 1
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

launch_app_in_simulator() {
  local scheme="$1"
  local app_bundle_name="$2"
  local bundle_id="$3"

  local derived_data destination udid app_path
  derived_data="${DERIVED_DATA:-${ios_app_dir}/.derived}"
  destination="$(simulator_destination)"
  udid="$(simulator_udid)"

  echo "Building ${scheme} for simulator (${destination})..."
  xcodebuild \
    -project "$project_path" \
    -scheme "$scheme" \
    -configuration Debug \
    -sdk iphonesimulator \
    -derivedDataPath "$derived_data" \
    -destination "$destination" \
    build

  app_path="${derived_data}/Build/Products/Debug-iphonesimulator/${app_bundle_name}"
  if [[ ! -d "$app_path" ]]; then
    echo "error: built app not found at ${app_path}" >&2
    return 1
  fi

  echo "Booting simulator ${udid}..."
  boot_simulator "$udid"
  sleep 2

  echo "Installing ${app_bundle_name}..."
  xcrun simctl install "$udid" "$app_path"

  echo "Launching ${bundle_id}..."
  xcrun simctl launch "$udid" "$bundle_id"
  echo "Done. ${scheme} should be open in Simulator."
}
