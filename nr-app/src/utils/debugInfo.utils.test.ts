import { DebugInfo, formatDebugInfo } from "./debugInfo.utils";

const baseInfo: DebugInfo = {
  appVersion: "0.0.4",
  buildNumber: 27,
  commitId: "abc1234",
  platform: "android",
  platformVersion: 34,
  isEmbeddedLaunch: true,
  generatedAt: new Date(2026, 6, 13, 9, 5),
};

describe("formatDebugInfo()", () => {
  it("includes version, build, platform and generation date", () => {
    const output = formatDebugInfo(baseInfo);

    expect(output).toContain("Generated: 2026-07-13 09:05");
    expect(output).toContain("App version: 0.0.4");
    expect(output).toContain("Build: 27");
    expect(output).toContain("Commit: abc1234");
    expect(output).toContain("Platform: android 34");
  });

  it("reports an embedded launch instead of OTA fields", () => {
    const output = formatDebugInfo(baseInfo);

    expect(output).toContain("Update: embedded build (no OTA update applied)");
    expect(output).not.toContain("Update channel:");
  });

  it("reports OTA update details when running an update", () => {
    const output = formatDebugInfo({
      ...baseInfo,
      isEmbeddedLaunch: false,
      updateChannel: "preview",
      updateId: "uuid-1",
      updateCreatedAt: new Date(2026, 6, 12, 18, 30),
    });

    expect(output).toContain("Update channel: preview");
    expect(output).toContain("Update ID: uuid-1");
    expect(output).toContain("Update published: 2026-07-12 18:30");
  });

  it("marks an unset identity explicitly rather than omitting it", () => {
    const output = formatDebugInfo(baseInfo);

    expect(output).toContain("npub: not set");
    expect(output).toContain("Trustroots username: not set");
  });

  it("includes identity when set", () => {
    const output = formatDebugInfo({
      ...baseInfo,
      npub: "npub1abc",
      trustrootsUsername: "marmaladeskies",
    });

    expect(output).toContain("npub: npub1abc");
    expect(output).toContain("Trustroots username: marmaladeskies");
  });
});
