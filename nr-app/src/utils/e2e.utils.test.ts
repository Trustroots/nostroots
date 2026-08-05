import { isE2EEnabled } from "./e2e.utils";

describe("e2e.utils", () => {
  const originalEnv = process.env.EXPO_PUBLIC_E2E;

  afterEach(() => {
    process.env.EXPO_PUBLIC_E2E = originalEnv;
  });

  it("is enabled only when EXPO_PUBLIC_E2E is 1", () => {
    process.env.EXPO_PUBLIC_E2E = "1";
    expect(isE2EEnabled()).toBe(true);

    process.env.EXPO_PUBLIC_E2E = "0";
    expect(isE2EEnabled()).toBe(false);
  });
});
