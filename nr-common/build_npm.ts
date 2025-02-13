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
  package: {
    // package.json properties
    name: "@trustroots/nr-common",
    version: Deno.args[0],
    description: "Your package.",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/trustroots/nostroots.git",
    },
    bugs: {
      url: "https://github.com/trustroots/nostroots/issues",
    },
  },
  filterDiagnostic(diagnostic) {
    if (diagnostic.file?.path.includes("/build/src/deps/")) {
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
