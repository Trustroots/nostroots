import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, expect, test } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIST = resolve(ROOT, "dist/chrome");
const ALICE = "0000000000000000000000000000000000000000000000000000000000000001";
const ALICE_PUBKEY = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
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
    await serviceWorker.evaluate(
      ([key, pubkey, nip05]) =>
        chrome.storage.local.set({
          [key]: { [pubkey]: nip05 },
        }),
      ["nostroots.browser.trustrootsNip05ByPubkey", ALICE_PUBKEY, "alice@trustroots.org"],
    );

    const signed = await trustedPage.evaluate(() =>
      window.nostr!.signEvent({ kind: 1, tags: [], content: "trusted" }),
    );
    expect((signed as { id: string }).id).toHaveLength(64);
    expect((signed as { sig: string }).sig).toHaveLength(128);

    const optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(optionsPage.locator("#trustroots-identity-status")).toHaveText("alice@trustroots.org");
    await expect(optionsPage.locator("#trustroots-identity-status")).toHaveAttribute(
      "href",
      "https://www.trustroots.org/profile/alice",
    );
    await expect(optionsPage.locator("#copy-nip05")).toHaveCount(0);
    await expect(optionsPage.getByRole("button", { name: "Reveal private key" })).toBeVisible();
    await expect(optionsPage.getByRole("button", { name: "Forget this key" })).toBeVisible();
    await expect(optionsPage.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "https://nos.trustroots.org/privacy/",
    );
    await expect(optionsPage.getByRole("heading", { name: "Site Access" })).toBeVisible();
    await expect(optionsPage.getByRole("link", { name: "*.trustroots.org" })).toHaveAttribute(
      "href",
      "https://nos.trustroots.org/",
    );
    await expect(optionsPage.getByText("No other sites have access yet.")).toBeVisible();

    await context.route("https://treasures.to/fixture", (route) =>
      route.fulfill({ contentType: "text/html", body: html }),
    );
    const unknownPage = await context.newPage();
    await unknownPage.goto("https://treasures.to/fixture");

    const requestingMultipleActions = unknownPage.evaluate(() =>
      Promise.all([
        window.nostr!.getPublicKey(),
        window.nostr!.signEvent({ kind: 1, tags: [], content: "unknown" }),
      ]),
    );
    const prompt = await context.waitForEvent("page", (page) =>
      page.url().startsWith(`chrome-extension://${extensionId}/prompt.html`),
    );
    await expect(prompt.getByText("Share public address")).toBeVisible();
    await expect(prompt.getByText(/^npub1/)).toBeVisible();
    await expect(prompt.getByText("Sign events")).toBeVisible();
    await prompt.waitForTimeout(300);
    expect(
      context.pages().filter((page) => page.url().startsWith(`chrome-extension://${extensionId}/prompt.html`)),
    ).toHaveLength(1);
    await expect(prompt.getByRole("button", { name: "Deny" })).toBeVisible();
    await expect(prompt.getByRole("button", { name: "Allow once" })).toBeVisible();
    await expect(prompt.getByRole("button", { name: "Always allow these actions" })).toBeVisible();
    await expect(prompt.getByRole("button", { name: "Always allow everything" })).toBeVisible();
    await expect(prompt.locator(".actions button")).toHaveText([
      "Deny",
      "Allow once",
      "Always allow these actions",
      "Always allow everything",
    ]);
    expect(
      await prompt.locator(".actions button").evaluateAll((buttons) =>
        buttons.every((button) => button.getBoundingClientRect().bottom <= window.innerHeight),
      ),
    ).toBe(true);
    await prompt.getByRole("button", { name: "Always allow these actions" }).click();
    const [, signedUnknown] = (await requestingMultipleActions) as [string, { id: string }];
    expect(signedUnknown).toHaveProperty("id");

    const stored = await serviceWorker.evaluate(() => chrome.storage.local.get("nostroots.browser.allowedOriginAccess"));
    expect(stored["nostroots.browser.allowedOriginAccess"]).toEqual({
      "https://treasures.to": { all: false, methods: ["getPublicKey", "signEvent"] },
    });

    await expect(optionsPage.getByRole("link", { name: "treasures.to" })).toHaveAttribute(
      "href",
      "https://treasures.to",
    );
    await expect(optionsPage.getByText("Share public address")).toBeVisible();
    await expect(optionsPage.getByText("Sign events")).toBeVisible();
    await expect(optionsPage.getByRole("button", { name: "Revoke treasures.to access" })).toBeVisible();
    await expect(optionsPage.getByText("No other sites have access yet.")).toBeHidden();

    await serviceWorker.evaluate(() => chrome.storage.local.remove("nostroots.browser.privateKeyHex"));
    await serviceWorker.evaluate(() => chrome.storage.local.remove("nostroots.browser.allowedOriginAccess"));
    expect(await serviceWorker.evaluate(() => chrome.storage.local.get("nostroots.browser.allowedOriginAccess"))).toEqual({});
  } finally {
    await context.close();
  }
});
