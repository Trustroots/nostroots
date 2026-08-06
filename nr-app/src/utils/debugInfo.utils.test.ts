import {
  DebugInfo,
  formatDebugInfo,
  formatSupportMessage,
  getUserMessageBudget,
  MAX_USER_MESSAGE_LENGTH,
  MIN_USER_MESSAGE_LENGTH,
  SUPPORT_MESSAGE_MAX_LENGTH,
} from "./debugInfo.utils";

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

  it("marks missing build and OTA metadata as unknown", () => {
    const output = formatDebugInfo({
      platform: "ios",
      platformVersion: "26.0",
      isEmbeddedLaunch: false,
      generatedAt: baseInfo.generatedAt,
    });

    expect(output).toContain("App version: unknown");
    expect(output).toContain("Build: unknown");
    expect(output).toContain("Commit: unknown");
    expect(output).toContain("Update channel: unknown");
    expect(output).toContain("Update ID: unknown");
    expect(output).toContain("Update published: unknown");
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
      trustrootsUsername: "wanderingpine",
    });

    expect(output).toContain("npub: npub1abc");
    expect(output).toContain("Trustroots username: wanderingpine");
  });
});

describe("formatSupportMessage()", () => {
  it("puts the user's message before the debug block", () => {
    const output = formatSupportMessage({
      userMessage: "The map is blank after I log in.",
      debugInfo: "Nostroots debug info\nApp version: 0.0.4",
    });

    expect(output.indexOf("The map is blank")).toBeLessThan(
      output.indexOf("Nostroots debug info"),
    );
  });

  it("separates the two sections", () => {
    const output = formatSupportMessage({
      userMessage: "Something broke",
      debugInfo: "Nostroots debug info",
    });

    expect(output).toContain("---");
  });

  it("trims surrounding whitespace from the user's message", () => {
    const output = formatSupportMessage({
      userMessage: "   padded   ",
      debugInfo: "debug",
    });

    expect(output.startsWith("padded")).toBe(true);
  });
});

describe("getUserMessageBudget()", () => {
  it("leaves room for the debug block and separator", () => {
    const debugInfo = "x".repeat(500);
    const budget = getUserMessageBudget(debugInfo);

    const composed = formatSupportMessage({
      userMessage: "y".repeat(budget),
      debugInfo,
    });

    expect(composed.length).toBeLessThanOrEqual(SUPPORT_MESSAGE_MAX_LENGTH);
  });

  it("offers the flat allowance when the debug block leaves room for it", () => {
    expect(getUserMessageBudget("x".repeat(500))).toBe(MAX_USER_MESSAGE_LENGTH);
  });

  it("falls back to the bridge's cap when the debug block is unusually long", () => {
    const debugInfo = "x".repeat(1700);
    const budget = getUserMessageBudget(debugInfo);

    expect(budget).toBeLessThan(MAX_USER_MESSAGE_LENGTH);

    const oversized = formatSupportMessage({
      userMessage: "y".repeat(budget + 1),
      debugInfo,
    });

    expect(oversized.length).toBeGreaterThan(SUPPORT_MESSAGE_MAX_LENGTH);
  });

  it("never returns a negative budget when debug info is huge", () => {
    expect(getUserMessageBudget("x".repeat(5000))).toBe(0);
  });

  it("exposes the minimum message length", () => {
    expect(MIN_USER_MESSAGE_LENGTH).toBe(50);
  });

  it("exposes the support message max length mirrored from nr-bridge", () => {
    expect(SUPPORT_MESSAGE_MAX_LENGTH).toBe(2000);
  });
});
