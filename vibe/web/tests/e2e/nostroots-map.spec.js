import { test, expect } from './fixtures.js';

test.describe('Nostroots Map experience', () => {
  test('loads the browser-native map-note shell', async ({ page }) => {
    await page.goto('/nostroots-map/');

    await expect(page.getByText('Nostroots', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Map' })).toBeVisible();
    await expect(page.locator('#nostroots-map')).toBeVisible();
    await expect(page.locator('#map-renderer-status')).toContainText(/map|fallback/i);
    await expect(page.getByRole('button', { name: /Trustroots/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Note' })).toBeDisabled();
    await expect(page.locator('#exact-count')).toHaveText('0');
    await expect(page.locator('#nearby-count')).toHaveText('0');
    await expect(page.locator('#relay-summary')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Map' })).toHaveClass(/active/);
    await expect(page.getByRole('button', { name: 'List' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Hub' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Trustroots Map' })).toHaveCount(0);
  });

  test('detects the Nostroots Browser NIP-07 signer', async ({ page }) => {
    await page.addInitScript(() => {
      window.nostr = {
        __nostrootsBrowser: true,
        getPublicKey: async () => '0'.repeat(64),
        signEvent: async (event) => event,
        nip44: {
          encrypt: async () => '',
          decrypt: async () => '',
        },
        nip04: {
          encrypt: async () => '',
          decrypt: async () => '',
        },
      };
    });

    await page.goto('/nostroots-map/');

    await expect(page.locator('#signer-status')).toHaveText('Nostroots Browser signer connected.');
    await expect(page.locator('#signer-status')).toHaveClass(/connected/);
  });

  test('updates when NIP-07 is injected after page init', async ({ page }) => {
    await page.addInitScript(() => {
      setTimeout(() => {
        window.nostr = {
          getPublicKey: async () => '1'.repeat(64),
          signEvent: async (event) => event,
        };
      }, 500);
    });

    await page.goto('/nostroots-map/');

    await expect(page.locator('#signer-status')).toHaveText('NIP-07 signer detected.');
    await expect(page.locator('#signer-status')).toHaveClass(/connected/);
  });

  test('opens the layer selector', async ({ page }) => {
    await page.goto('/nostroots-map/');

    await page.getByRole('button', { name: /Trustroots/ }).click();
    await expect(page.getByRole('button', { name: /Unverified/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /All notes/ })).toBeVisible();
  });
});
