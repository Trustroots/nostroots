import { test, expect } from './fixtures.js';

const TEST_PRIV_HEX = '0000000000000000000000000000000000000000000000000000000000000001';

/** secp256k1 pubkey for secret key 0x…01 (same as unit tests / header-nav). */
const PROFILE_NPUB = 'npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((hex) => {
    try {
      localStorage.clear();
      localStorage.setItem('nostr_private_key', hex);
    } catch (_) {}
  }, TEST_PRIV_HEX);
});

test.describe('Public profile (#profile/)', () => {
  test('Account menu lists profile actions when a key is loaded', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 720 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('#nav-user-btn').click();
    await expect(page.getByRole('menuitem', { name: 'My profile' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Edit profile' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Contacts' })).toBeVisible();
  });

  test('profile/…/edit shows edit form for own npub', async ({ page }) => {
    await page.goto(`/#profile/${PROFILE_NPUB}/edit`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body.nr-surface-profile')).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#nr-profile-toolbar-title')).toHaveText('Edit profile');
    await expect(page.locator('.nr-profile-edit-form')).toBeVisible({ timeout: 30000 });
  });

  test('profile hash shows profile shell; Map returns to map', async ({ page }) => {
    await page.goto(`/#profile/${PROFILE_NPUB}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body.nr-surface-profile')).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#nr-profile-view')).toBeVisible();
    await expect(page.locator('#map-view')).toBeHidden();

    await page.locator('#nav-map-btn').click();
    await page.waitForTimeout(400);
    await expect(page.locator('body.nr-surface-profile')).toHaveCount(0);
    await expect(page.locator('#map-view')).toBeVisible();
  });
});
