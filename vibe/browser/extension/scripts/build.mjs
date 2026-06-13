import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const watch = process.argv.includes("--watch");
const target = targetFromArgs();
const targets = target === "all" ? ["chrome", "firefox"] : [target];
const buildTime = formatBuildTime(new Date());

if (target === "all" && watch) {
  throw new Error("Watch mode requires --target=chrome or --target=firefox.");
}

if (target === "all") {
  await rm(dist, { force: true, recursive: true });
  await mkdir(dist, { recursive: true });
}

await Promise.all(targets.map((browserTarget) => buildTarget(browserTarget)));

async function buildTarget(browserTarget) {
  const targetDist = resolve(dist, browserTarget);
  await rm(targetDist, { force: true, recursive: true });
  await mkdir(targetDist, { recursive: true });

  await Promise.all([
    writeManifest(browserTarget, targetDist),
    cp(resolve(root, "src/ui/options.html"), resolve(targetDist, "options.html")),
    cp(resolve(root, "src/ui/popup.html"), resolve(targetDist, "popup.html")),
    cp(resolve(root, "src/ui/prompt.html"), resolve(targetDist, "prompt.html")),
    cp(resolve(root, "src/ui/styles.css"), resolve(targetDist, "styles.css")),
    cp(resolve(root, "src/ui/nostroots-logo.png"), resolve(targetDist, "nostroots-logo.png")),
    cp(resolve(root, "src/ui/icons"), resolve(targetDist, "icons"), { recursive: true }),
  ]);

  const common = {
    bundle: true,
    define: {
      __NOSTROOTS_EXTENSION_BUILD_TIME__: JSON.stringify(buildTime),
    },
    sourcemap: true,
    target: "es2022",
    logLevel: "info",
  };

  const builds = [
    {
      ...common,
      entryPoints: [resolve(root, "src/background.ts")],
      outfile: resolve(targetDist, "background.js"),
      format: browserTarget === "firefox" ? "iife" : "esm",
    },
    ...[
      ["content", "src/content.ts"],
      ["provider", "src/provider.ts"],
      ["options", "src/options.ts"],
      ["popup", "src/popup.ts"],
      ["prompt", "src/prompt.ts"],
    ].map(([name, entry]) => ({
      ...common,
      entryPoints: [resolve(root, entry)],
      outfile: resolve(targetDist, `${name}.js`),
      format: "iife",
    })),
  ];

  if (watch) {
    const contexts = await Promise.all(builds.map((options) => esbuild.context(options)));
    await Promise.all(contexts.map((context) => context.watch()));
    console.log(`Watching ${resolve(root, "src")} and rebuilding ${targetDist}`);
  } else {
    await Promise.all(builds.map((options) => esbuild.build(options)));
  }
}

async function writeManifest(browserTarget, targetDist) {
  const manifest = JSON.parse(await readFile(resolve(root, "src/manifest.json"), "utf8"));

  if (browserTarget === "firefox") {
    manifest.background = {
      scripts: ["background.js"],
    };
    manifest.permissions = manifest.permissions.filter((permission) => permission !== "windows");
    manifest.browser_specific_settings = {
      gecko: {
        id: "nostroots-extension@trustroots.org",
        strict_min_version: "140.0",
        data_collection_permissions: {
          required: ["none"],
        },
      },
      gecko_android: {
        strict_min_version: "142.0",
      },
    };
  } else {
    manifest.background = {
      service_worker: "background.js",
      type: "module",
    };
    delete manifest.browser_specific_settings;
  }

  await writeFile(resolve(targetDist, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function targetFromArgs() {
  const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
  const value = targetArg ? targetArg.slice("--target=".length) : "all";

  if (value === "chrome" || value === "firefox" || value === "all") {
    return value;
  }

  throw new Error("Expected --target=chrome, --target=firefox, or --target=all.");
}

function formatBuildTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
