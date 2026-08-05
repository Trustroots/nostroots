#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="${LOG_DIR:-.e2e-logs/ios}"
IOS_SIMULATOR_NAME="${IOS_SIMULATOR_NAME:-}"
IOS_SIMULATOR_UDID="${IOS_SIMULATOR_UDID:-}"
ERASE_SIMULATOR="${ERASE_SIMULATOR:-0}"
SIMULATOR_STATE_LOG="${LOG_DIR}/simulator-state.txt"

mkdir -p "${LOG_DIR}"

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun not found. Install Xcode command line tools first." >&2
  exit 1
fi

select_simulator() {
  xcrun simctl list devices available --json | IOS_SIMULATOR_NAME="${IOS_SIMULATOR_NAME}" node -e '
const fs = require("fs");

const desiredName = process.env.IOS_SIMULATOR_NAME || "";
const data = JSON.parse(fs.readFileSync(0, "utf8"));
const runtimes = Object.keys(data.devices || {}).sort().reverse();
const devices = runtimes.flatMap((runtime) =>
  (data.devices[runtime] || [])
    .filter((device) => device.isAvailable !== false)
    .map((device) => ({ ...device, runtime })),
);

const iphones = devices.filter((device) => device.name.includes("iPhone"));
const exact = desiredName
  ? iphones.find((device) => device.name === desiredName)
  : null;
const partial = desiredName
  ? iphones.find((device) => device.name.includes(desiredName))
  : null;
const preferredNames = [
  "iPhone 16 Pro",
  "iPhone 15 Pro",
  "iPhone 14 Pro",
  "iPhone 13 Pro",
  "iPhone 16",
  "iPhone 15",
  "iPhone 14",
  "iPhone 13",
];
const preferred = iphones.find((device) =>
  preferredNames.includes(device.name),
);
const selected = exact || partial || preferred || iphones[0];

if (!selected) {
  console.error("No available iPhone simulator found.");
  process.exit(1);
}

console.log(`${selected.udid}\t${selected.name}\t${selected.runtime}`);
'
}

if [ -n "${IOS_SIMULATOR_UDID}" ]; then
  selected_line="${IOS_SIMULATOR_UDID}\tcustom\tcustom"
else
  selected_line="$(select_simulator)"
fi

SIMULATOR_UDID="$(printf '%b' "${selected_line}" | awk -F '\t' '{ print $1 }')"
SIMULATOR_NAME="$(printf '%b' "${selected_line}" | awk -F '\t' '{ print $2 }')"
SIMULATOR_RUNTIME="$(printf '%b' "${selected_line}" | awk -F '\t' '{ print $3 }')"

echo "Selected iOS simulator: ${SIMULATOR_NAME} (${SIMULATOR_UDID}) ${SIMULATOR_RUNTIME}"

if [ "${ERASE_SIMULATOR}" = "1" ]; then
  echo "Erasing simulator ${SIMULATOR_UDID}..."
  xcrun simctl shutdown "${SIMULATOR_UDID}" >/dev/null 2>&1 || true
  xcrun simctl erase "${SIMULATOR_UDID}"
fi

echo "Booting simulator ${SIMULATOR_UDID}..."
xcrun simctl boot "${SIMULATOR_UDID}" >/dev/null 2>&1 || true
xcrun simctl bootstatus "${SIMULATOR_UDID}" -b

{
  echo "xcrun simctl list devices"
  xcrun simctl list devices
  echo
  echo "Booted app containers for org.trustroots.nostroots:"
  xcrun simctl get_app_container "${SIMULATOR_UDID}" org.trustroots.nostroots app 2>/dev/null || true
} | tee "${SIMULATOR_STATE_LOG}"

echo "Simulator state log: ${SIMULATOR_STATE_LOG}"
echo "IOS_SIMULATOR_UDID=${SIMULATOR_UDID}"
