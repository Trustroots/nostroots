#!/usr/bin/env node
/* eslint-env node */
/**
 * Build for a USB-connected iPhone with Trustroots signing.
 * Uses xcodebuild provisioning flags directly because expo run:ios skips them
 * when DEVELOPMENT_TEAM is already set, and may pick the wrong Apple team.
 */
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

require("./write-build-time.js");

const TEAM_ID = "SUJ594N47C";
const BUNDLE_ID = "org.trustroots.nostroots.browser";
const DEFAULT_DEVICE = "ip2";
const DEFAULT_UDID = "00008130-000C69642152001C";

const projectRoot = path.join(__dirname, "..");
const workspace = path.join(
  projectRoot,
  "ios/NostrootsBrowser.xcworkspace",
);
const derivedDataPath = path.join(projectRoot, "ios/build-device");
const appPath = path.join(
  derivedDataPath,
  "Build/Products/Debug-iphoneos/NostrootsBrowser.app",
);

const deviceArg = process.argv.slice(2).find((arg) => arg !== "--");
const deviceName = deviceArg || DEFAULT_DEVICE;
const deviceUdid = deviceName === DEFAULT_DEVICE ? DEFAULT_UDID : deviceName;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolveLocalIp() {
  const output = spawnSync("ipconfig", ["getifaddr", "en0"], {
    encoding: "utf8",
  });
  const ip = output.stdout?.trim();
  return ip || "127.0.0.1";
}

console.log(`Building for device ${deviceName} (${deviceUdid}) with team ${TEAM_ID}`);

run("xcodebuild", [
  "-workspace",
  workspace,
  "-scheme",
  "NostrootsBrowser",
  "-configuration",
  "Debug",
  "-destination",
  `id=${deviceUdid}`,
  "-derivedDataPath",
  derivedDataPath,
  `DEVELOPMENT_TEAM=${TEAM_ID}`,
  "-allowProvisioningUpdates",
  "-allowProvisioningDeviceRegistration",
  "build",
], {
  env: {
    ...process.env,
    RCT_NO_LAUNCH_PACKAGER: "true",
  },
});

if (!fs.existsSync(appPath)) {
  console.error(`Expected app bundle at ${appPath}`);
  process.exit(1);
}

console.log(`Installing ${appPath}`);
run("xcrun", [
  "devicectl",
  "device",
  "install",
  "app",
  "--device",
  deviceUdid,
  appPath,
]);

const metroPort = process.env.RCT_METRO_PORT || "8081";
const localIp = resolveLocalIp();
const devClientUrl = `exp+nr-browser://expo-development-client/?url=${encodeURIComponent(
  `http://${localIp}:${metroPort}`,
)}`;

console.log("Starting Metro bundler");
const metro = spawn(
  "npx",
  ["expo", "start", "--dev-client", "--port", metroPort],
  {
    cwd: projectRoot,
    stdio: "inherit",
    detached: true,
  },
);
metro.unref();

console.log(`Launching ${BUNDLE_ID}`);
run("xcrun", [
  "devicectl",
  "device",
  "process",
  "launch",
  "--device",
  deviceUdid,
  BUNDLE_ID,
  "--payload-url",
  devClientUrl,
]);

console.log(`App installed. Metro: http://${localIp}:${metroPort}`);
