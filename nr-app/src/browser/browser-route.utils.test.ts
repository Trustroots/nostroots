import { resolveNip7BrowserInitialUrl } from "@/browser/browser-route.utils";
import { NOSTROOTS_WEB_URL } from "@/constants";

describe("resolveNip7BrowserInitialUrl", () => {
  it("defaults to Nostroots web when url is missing", () => {
    expect(resolveNip7BrowserInitialUrl(undefined)).toBe(NOSTROOTS_WEB_URL);
  });

  it("uses a valid https origin", () => {
    expect(resolveNip7BrowserInitialUrl("https://example.com")).toBe(
      "https://example.com",
    );
  });

  it("normalizes a full https page URL to its origin", () => {
    expect(resolveNip7BrowserInitialUrl("https://example.com/path#hash")).toBe(
      "https://example.com",
    );
  });

  it("falls back for invalid or non-http(s) values", () => {
    expect(resolveNip7BrowserInitialUrl("mailto:hello@example.com")).toBe(
      NOSTROOTS_WEB_URL,
    );
    expect(resolveNip7BrowserInitialUrl("not-a-url")).toBe(NOSTROOTS_WEB_URL);
  });
});
