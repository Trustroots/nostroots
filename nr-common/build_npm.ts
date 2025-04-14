// ex. scripts/build_npm.ts
import { build, emptyDir } from "@deno/dnt";

await emptyDir("./build");

await build({
  entryPoints: ["./mod.ts"],
  outDir: "./build",
  shims: {
    // see JS docs for overview and more options
    deno: true,
  },
  test: false,
  importMap: "deno.jsonc",
  packageManager: "pnpm",
  skipSourceOutput: true,
  skipNpmInstall: true,
  package: {
    // package.json properties
    name: "@trustroots/nr-common",
    version: Deno.args[0],
    description: "Your package.",
    license: "AGPL-3.0",
    repository: {
      type: "git",
      url: "git+https://github.com/trustroots/nostroots.git",
    },
    bugs: {
      url: "https://github.com/trustroots/nostroots/issues",
    },
    main: "./esm/mod.js",
  },
  filterDiagnostic(diagnostic) {
    if (
      diagnostic.file?.path.includes("/build/src/deps/") &&
      (diagnostic.file?.path.endsWith("/assertion_error.ts") ||
        diagnostic.file?.path.endsWith("/_equal.ts"))
    ) {
      return false; // ignore all diagnostics in this file
    }
    // etc... more checks here
    return true;
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("README.md", "build/README.md");
  },
});
