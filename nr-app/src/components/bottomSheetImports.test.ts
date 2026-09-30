import fs from "fs";
import path from "path";

// @expo/ui's bottom sheet can't scroll on Android (expo/expo#46379, #280).
const FORBIDDEN_IMPORT = "@expo/ui/community/bottom-sheet";
const APP_ROOT = path.resolve(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [fullPath]
      : [];
  });
}

describe("bottom sheet imports", () => {
  it(`never imports ${FORBIDDEN_IMPORT}`, () => {
    const offenders = ["src", "app"]
      .flatMap((dir) => sourceFiles(path.join(APP_ROOT, dir)))
      .filter((file) =>
        fs.readFileSync(file, "utf8").includes(FORBIDDEN_IMPORT),
      )
      .map((file) => path.relative(APP_ROOT, file));

    expect(offenders).toEqual([]);
  });
});
