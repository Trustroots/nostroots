import {
  createAnalyticsPayload,
  sanitizeAnalyticsData,
} from "./analytics.service";

describe("analytics service", () => {
  it("removes query parameters and fragments from screen paths", () => {
    const payload = createAnalyticsPayload(
      "/onboarding/backup-confirm?from=bridge#secret",
    );

    expect(payload.url).toBe("/onboarding/backup-confirm");
    expect(payload.title).toBe("/onboarding/backup-confirm");
    expect(payload.website).toBe("ba3d08c7-1790-45e6-9bfb-51e6cfbd0c50");
  });

  it("only permits anonymous categorical event data", () => {
    expect(
      sanitizeAnalyticsData({
        method: "Bridge Flow",
        outcome: "Success",
        username: "private-user",
        content: "private note",
      }),
    ).toEqual({
      method: "bridge_flow",
      outcome: "success",
    });
  });

  it("sanitizes event names and ignores data on page views", () => {
    expect(
      createAnalyticsPayload("/welcome", "Onboarding Started!", {
        source: "Welcome Screen",
      }),
    ).toMatchObject({
      name: "onboarding_started_",
      data: { source: "welcome_screen" },
    });

    expect(createAnalyticsPayload("/welcome")).not.toHaveProperty("data");
  });
});
