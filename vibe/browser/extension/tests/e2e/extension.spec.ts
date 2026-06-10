import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, expect, test } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIST = resolve(ROOT, "dist/chrome");
const ALICE = "0000000000000000000000000000000000000000000000000000000000000001";
const BROWSER_CANDIDATES = [
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/opt/homebrew/bin/chromium",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

test("NIP-07 provider signs on trusted origins and prompts unknown origins", async () => {
  test.setTimeout(60_000);
  const userDataDir = test.info().outputPath("profile");
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: BROWSER_CANDIDATES.find((path) => existsSync(path)),
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });

  try {
    const html = await readFile(resolve(ROOT, "tests/e2e/fixtures/page.html"), "utf8");
    await context.route("https://nos.trustroots.org/fixture", (route) =>
      route.fulfill({ contentType: "text/html", body: html }),
    );

    const trustedPage = await context.newPage();
    await trustedPage.goto("https://nos.trustroots.org/fixture");
    await expect
      .poll(() => trustedPage.evaluate(() => Boolean(window.nostr?.__nostrootsBrowser)))
      .toBe(true);

    await trustedPage.evaluate(() => window.nostr!.getPublicKey()).catch(() => undefined);
    const serviceWorker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(serviceWorker.url()).host;
    await serviceWorker.evaluate(
      ([key, value]) => chrome.storage.local.set({ [key]: value }),
      ["nostroots.browser.privateKeyHex", ALICE],
    );

    const signed = await trustedPage.evaluate(() =>
      window.nostr!.signEvent({ kind: 1, tags: [], content: "trusted" }),
    );
    expect((signed as { id: string }).id).toHaveLength(64);
    expect((signed as { sig: string }).sig).toHaveLength(128);

    await context.route("https://example.com/fixture", (route) =>
      route.fulfill({ contentType: "text/html", body: html }),
    );
    const unknownPage = await context.newPage();
    await unknownPage.goto("https://example.com/fixture");

    const signing = unknownPage.evaluate(() =>
      window.nostr!.signEvent({ kind: 1, tags: [], content: "unknown" }),
    );
    const prompt = await context.waitForEvent("page", (page) =>
      page.url().startsWith(`chrome-extension://${extensionId}/prompt.html`),
    );
    await prompt.getByRole("button", { name: "Always allow" }).click();
    expect((await signing) as { id: string }).toHaveProperty("id");

    const stored = await serviceWorker.evaluate(() => chrome.storage.local.get("nostroots.browser.allowedOrigins"));
    expect(stored["nostroots.browser.allowedOrigins"]).toEqual(["https://example.com"]);

    await serviceWorker.evaluate(() => chrome.storage.local.remove("nostroots.browser.privateKeyHex"));
    await serviceWorker.evaluate(() => chrome.storage.local.remove("nostroots.browser.allowedOrigins"));
    expect(await serviceWorker.evaluate(() => chrome.storage.local.get("nostroots.browser.allowedOrigins"))).toEqual({});
  } finally {
    await context.close();
  }
});
