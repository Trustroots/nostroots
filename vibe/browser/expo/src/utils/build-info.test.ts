import { formatBuildTime, getBuildTimeText } from "@/utils/build-info";

describe("build info", () => {
  it("formats build time as yyyy-mm-dd hh:mm", () => {
    expect(formatBuildTime("2026-06-02T15:04:00")).toBe("2026-06-02 15:04");
  });

  it("returns unknown for missing or invalid build time", () => {
    expect(formatBuildTime(null)).toBe("Unknown");
    expect(formatBuildTime("not a date")).toBe("Unknown");
  });

  it("reads the Expo config build time", () => {
    expect(getBuildTimeText()).toBe("2026-06-02 15:04");
  });
});
