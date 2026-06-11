import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2];

if (target !== "chrome" && target !== "firefox") {
  throw new Error("Usage: node scripts/package.mjs chrome|firefox");
}

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const packageDir = resolve(root, "packages");
const zipName = `nostroots-extension-${target}-${packageJson.version}.zip`;
const zipPath = resolve(packageDir, zipName);

await run("node", ["scripts/build.mjs", `--target=${target}`], { cwd: root });
await mkdir(packageDir, { recursive: true });
await rm(zipPath, { force: true });
await run("zip", ["-qr", zipPath, "."], { cwd: resolve(root, "dist", target) });

console.log(`Created ${zipPath}`);

function run(command, args, options) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", rejectRun);
    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}
