import { DEFAULT_RELAY_URL } from "@trustroots/nr-common";

describe("config/env", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("defaults to the production Trustroots domain and relay", () => {
    delete process.env.EXPO_PUBLIC_TRUSTROOTS_NIP05_DOMAIN;
    delete process.env.EXPO_PUBLIC_DEFAULT_RELAY_URL;

    const { TRUSTROOTS_NIP05_DOMAIN, RELAY_URL } = require("./env");

    expect(TRUSTROOTS_NIP05_DOMAIN).toBe("trustroots.org");
    expect(RELAY_URL).toBe(DEFAULT_RELAY_URL);
  });

  it("uses the overrides when they are set", () => {
    process.env.EXPO_PUBLIC_TRUSTROOTS_NIP05_DOMAIN = "localhost:8787";
    process.env.EXPO_PUBLIC_DEFAULT_RELAY_URL = "ws://localhost:8787";

    const { TRUSTROOTS_NIP05_DOMAIN, RELAY_URL } = require("./env");

    expect(TRUSTROOTS_NIP05_DOMAIN).toBe("localhost:8787");
    expect(RELAY_URL).toBe("ws://localhost:8787");
  });

  it("ignores blank overrides", () => {
    process.env.EXPO_PUBLIC_TRUSTROOTS_NIP05_DOMAIN = "   ";
    process.env.EXPO_PUBLIC_DEFAULT_RELAY_URL = "";

    const { TRUSTROOTS_NIP05_DOMAIN, RELAY_URL } = require("./env");

    expect(TRUSTROOTS_NIP05_DOMAIN).toBe("trustroots.org");
    expect(RELAY_URL).toBe(DEFAULT_RELAY_URL);
  });
});
