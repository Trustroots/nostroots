import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const watch = process.argv.includes("--watch");

await rm(dist, { force: true, recursive: true });
await mkdir(dist, { recursive: true });

await Promise.all([
  cp(resolve(root, "src/manifest.json"), resolve(dist, "manifest.json")),
  cp(resolve(root, "src/ui/options.html"), resolve(dist, "options.html")),
  cp(resolve(root, "src/ui/popup.html"), resolve(dist, "popup.html")),
  cp(resolve(root, "src/ui/prompt.html"), resolve(dist, "prompt.html")),
  cp(resolve(root, "src/ui/styles.css"), resolve(dist, "styles.css")),
  cp(resolve(root, "src/ui/nostroots-logo.png"), resolve(dist, "nostroots-logo.png")),
]);

const common = {
  bundle: true,
  sourcemap: true,
  target: "es2022",
  logLevel: "info",
};

const builds = [
  {
    ...common,
    entryPoints: [resolve(root, "src/background.ts")],
    outfile: resolve(dist, "background.js"),
    format: "esm",
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
    outfile: resolve(dist, `${name}.js`),
    format: "iife",
  })),
];

if (watch) {
  const contexts = await Promise.all(builds.map((options) => esbuild.context(options)));
  await Promise.all(contexts.map((context) => context.watch()));
  console.log(`Watching ${resolve(root, "src")} and rebuilding ${dist}`);
} else {
  await Promise.all(builds.map((options) => esbuild.build(options)));
}
