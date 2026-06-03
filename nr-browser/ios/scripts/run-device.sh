#!/usr/bin/env bash
# Build Nostroots Browser (incrementally, when sources changed) and run on iPhone.
#
# Optional env:
#   DEVICE_NAME      default: ip2
#   DEVICE_UDID      skip name lookup when set
#   DEVELOPMENT_TEAM default: SUJ594N47C (Trustroots Foundation)
#   DERIVED_DATA     default: nr-browser/ios/.build/device
#   CLEAN_BUILD      set to 1 to remove derived data before building
#   FORCE_BUILD      set to 1 to always run xcodebuild
#   SKIP_BUILD       set to 1 to install/launch an existing device build

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ios_dir="$(cd "${script_dir}/.." && pwd)"

scheme="NostrootsBrowser"
app_bundle_name="Nostroots Browser.app"
app_executable_name="Nostroots Browser"
bundle_id="org.trustroots.nostroots.browser"
development_team="${DEVELOPMENT_TEAM:-SUJ594N47C}"
derived_data="${DERIVED_DATA:-${ios_dir}/.build/device}"
device_name="${DEVICE_NAME:-ip2}"

extract_device_udid() {
  local line="$1"
  if [[ "$line" =~ \(([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})\) ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
  fi
}

device_udid_from_xcodebuild() {
  xcodebuild \
    -project "${ios_dir}/NostrootsBrowser.xcodeproj" \
    -scheme "$scheme" \
    -showdestinations 2>/dev/null \
    | grep -F "name:${device_name} " \
    | grep -F "platform:iOS," \
    | grep -v Simulator \
    | head -1 \
    | sed -n 's/.*id:\([^,}]*\).*/\1/p'
}

device_udid_from_xctrace() {
  local section="$1"
  local line
  line="$(
    printf '%s\n' "$section" \
      | grep -F "${device_name} (" \
      | grep -v Simulator \
      | head -1
  )"
  if [[ -n "$line" ]]; then
    extract_device_udid "$line"
  fi
}

device_udid() {
  if [[ -n "${DEVICE_UDID:-}" ]]; then
    printf '%s' "$DEVICE_UDID"
    return
  fi

  local udid devices offline
  udid="$(device_udid_from_xcodebuild)"
  if [[ -n "$udid" ]]; then
    printf '%s' "$udid"
    return
  fi

  devices="$(xcrun xctrace list devices 2>/dev/null)"
  offline="${devices#*== Devices Offline ==}"
  if [[ "$offline" == "$devices" ]]; then
    offline=""
  else
    devices="${devices%%== Devices Offline ==*}"
  fi

  udid="$(device_udid_from_xctrace "$devices")"
  if [[ -n "$udid" ]]; then
    printf '%s' "$udid"
    return
  fi

  udid="$(device_udid_from_xctrace "$offline")"
  if [[ -n "$udid" ]]; then
    echo "note: xctrace lists '${device_name}' as offline; using UDID ${udid}" >&2
    printf '%s' "$udid"
    return
  fi

  echo "error: no device named '${device_name}'" >&2
  echo "hint: run 'xcodebuild -showdestinations -project NostrootsBrowser.xcodeproj -scheme NostrootsBrowser'" >&2
  echo "hint: or set DEVICE_UDID to the 36-character device id" >&2
  exit 1
}

latest_source_epoch() {
  local latest=0 epoch file
  while IFS= read -r -d '' file; do
    epoch="$(stat -f '%m' "$file")"
    if (( epoch > latest )); then
      latest="$epoch"
    fi
  done < <(
    find "${ios_dir}/SharedCore" "${ios_dir}/NostrootsBrowserApp" \
      -type f \( -name '*.swift' -o -name 'Info.plist' \) -print0 2>/dev/null
    printf '%s\0' "${ios_dir}/NostrootsBrowser.xcodeproj/project.pbxproj"
  )
  printf '%s' "$latest"
}

needs_rebuild() {
  local app_binary="$1"
  local app_epoch source_epoch

  if [[ "${FORCE_BUILD:-0}" == "1" ]]; then
    return 0
  fi

  if [[ ! -d "$app_path" ]]; then
    return 0
  fi

  if [[ ! -f "$app_binary" ]]; then
    return 0
  fi

  app_epoch="$(stat -f '%m' "$app_binary")"
  source_epoch="$(latest_source_epoch)"
  if (( source_epoch > app_epoch )); then
    return 0
  fi

  if ! codesign -dv "$app_path" >/dev/null 2>&1; then
    return 0
  fi

  return 1
}

udid="$(device_udid)"
app_path="${derived_data}/Build/Products/Debug-iphoneos/${app_bundle_name}"
app_binary="${app_path}/${app_executable_name}"

if [[ "${CLEAN_BUILD:-0}" == "1" ]]; then
  echo "Removing ${derived_data}..."
  rm -rf "$derived_data"
fi

if [[ "${SKIP_BUILD:-0}" == "1" ]]; then
  echo "Skipping build (SKIP_BUILD=1)..."
elif needs_rebuild "$app_binary"; then
  echo "Building ${scheme} for device ${device_name} (${udid})..."
  xcodebuild \
    -project "${ios_dir}/NostrootsBrowser.xcodeproj" \
    -scheme "$scheme" \
    -configuration Debug \
    -sdk iphoneos \
    -derivedDataPath "$derived_data" \
    -destination "id=${udid}" \
    DEVELOPMENT_TEAM="$development_team" \
    CODE_SIGN_STYLE=Automatic \
    CODE_SIGN_IDENTITY="Apple Development" \
    CODE_SIGNING_ALLOWED=YES \
    CODE_SIGNING_REQUIRED=YES \
    -allowProvisioningUpdates \
    -allowProvisioningDeviceRegistration \
    build
else
  echo "No source changes since last device build; skipping xcodebuild."
fi

if [[ ! -d "$app_path" ]]; then
  echo "error: built app not found at ${app_path}" >&2
  echo "hint: run without SKIP_BUILD=1 to build first" >&2
  exit 1
fi

if ! codesign -dv "$app_path" >/dev/null 2>&1; then
  echo "error: app is not code-signed; check Xcode account and DEVELOPMENT_TEAM" >&2
  exit 1
fi

echo "Installing ${app_bundle_name} on ${device_name}..."
xcrun devicectl device install app --device "$udid" "$app_path"

echo "Launching ${bundle_id}..."
xcrun devicectl device process launch --device "$udid" "$bundle_id"

echo "Done. ${scheme} should be open on ${device_name}."
