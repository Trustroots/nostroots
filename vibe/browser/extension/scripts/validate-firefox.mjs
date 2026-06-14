import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "dist/firefox/manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const errors = [];

if (manifest.manifest_version !== 3) {
  errors.push("manifest_version must be 3.");
}

if (!manifest.background?.scripts?.includes("background.js")) {
  errors.push("Firefox build must use background.scripts with background.js.");
}

if (manifest.background?.service_worker) {
  errors.push("Firefox build must not include background.service_worker.");
}

if (!manifest.browser_specific_settings?.gecko?.id) {
  errors.push("Firefox build must include browser_specific_settings.gecko.id.");
}

if (manifest.browser_specific_settings?.gecko?.strict_min_version !== "140.0") {
  errors.push("Firefox build must require Firefox 140 or newer for data collection permissions support.");
}

if (manifest.browser_specific_settings?.gecko_android?.strict_min_version !== "142.0") {
  errors.push("Firefox build must require Firefox for Android 142 or newer for data collection permissions support.");
}

if (!manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required?.includes("none")) {
  errors.push("Firefox build must declare no data collection for AMO.");
}

if (!Array.isArray(manifest.permissions) || !manifest.permissions.includes("storage")) {
  errors.push("Firefox build must request storage permission.");
}

if (manifest.permissions?.includes("windows")) {
  errors.push("Firefox build must not request the unsupported windows permission.");
}

if (!Array.isArray(manifest.content_scripts) || manifest.content_scripts.length === 0) {
  errors.push("Firefox build must include content scripts.");
}

if (!Array.isArray(manifest.web_accessible_resources) || manifest.web_accessible_resources.length === 0) {
  errors.push("Firefox build must expose provider.js as a web accessible resource.");
}

for (const pattern of collectMatchPatterns(manifest)) {
  if (/^https?:\/\/[^/]+:\*\//.test(pattern)) {
    errors.push(`Firefox match patterns must not include port wildcards: ${pattern}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`Firefox manifest validation failed: ${error}`);
  process.exit(1);
}

console.log(`Firefox manifest validation passed: ${manifestPath}`);

function collectMatchPatterns(manifest) {
  const contentScriptMatches = (manifest.content_scripts ?? []).flatMap((script) => script.matches ?? []);
  const webAccessibleMatches = (manifest.web_accessible_resources ?? []).flatMap(
    (resource) => resource.matches ?? [],
  );

  return [...contentScriptMatches, ...webAccessibleMatches];
}
