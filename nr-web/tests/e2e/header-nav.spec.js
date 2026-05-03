import { test, expect } from './fixtures.js';

/** Valid secp256k1 scalar (test-only); avoids onboarding keys modal blocking header. */
const TEST_PRIV_HEX = '0000000000000000000000000000000000000000000000000000000000000001';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((hex) => {
    try {
      localStorage.clear();
      localStorage.setItem('nostr_private_key', hex);
    } catch (_) {}
  }, TEST_PRIV_HEX);
});

async function openUserMenuIfNeeded(page) {
  const settingsBtn = page.locator('#settings-icon-btn');
  if (await settingsBtn.isVisible()) return;
  const settingsMobile = page.locator('#settings-icon-btn-mobile');
  if (await settingsMobile.isVisible()) return;
  const menuBtn = page.locator('#nav-user-btn');
  if (await menuBtn.isVisible()) {
    await menuBtn.click();
    await page.waitForTimeout(200);
    return;
  }
  const moreBtn = page.locator('#nav-more-btn');
  if (await moreBtn.isVisible()) {
    await moreBtn.click();
    await page.waitForTimeout(200);
  }
}

async function openSupportMenuIfNeeded(page) {
  const supportBtn = page.locator('#nav-support-btn');
  if (await supportBtn.isVisible()) {
    await supportBtn.click();
    return;
  }
  await page.locator('#nav-more-btn').click();
  await page.waitForTimeout(200);
}

test.describe('Header navigation', () => {
  test('index: main nav items and Chats link', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const header = page.locator('#app-header');
    await expect(header.locator('#nav-support-btn').or(header.locator('#nav-more-btn')).first()).toBeVisible();
    await expect(header.getByRole('link', { name: 'Chats' })).toBeVisible();
    await expect(header.locator('#nav-map-btn')).toBeVisible();
    await expect(header.locator('#nav-host-btn')).toBeVisible();
    await expect(header.locator('#nav-user-btn').or(header.locator('#nav-more-btn')).first()).toBeVisible();
    const conv = header.getByRole('link', { name: 'Chats' });
    await expect(conv).toHaveAttribute('href', '#chat');
    await expect(header.locator('a[href="index.html"].app-header-logo-link')).toBeAttached();
    await expect(header.locator('[data-nav="nostroots"]')).toHaveCount(0);
  });

  test('index: Support dropdown opens and Support chat goes to #support', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await openSupportMenuIfNeeded(page);
    const supportChat = page.locator('#nav-support-chat-link').or(page.locator('.nr-nav-support-chat-link')).first();
    await expect(supportChat).toBeVisible();
    await expect(supportChat).toHaveAttribute('href', '#support');
    await expect(supportChat).toHaveText('Support chat');
    await supportChat.click();
    await expect(page).toHaveURL(/#support\b/);
    await expect(page.locator('body.nr-surface-chat')).toBeVisible({ timeout: 20000 });
  });

  test('index: Account menu opens and Settings control is reachable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await openUserMenuIfNeeded(page);
    await expect(
      page.locator('#settings-icon-btn').or(page.locator('#settings-icon-btn-mobile')).first(),
    ).toBeVisible();
  });

  test('index: Map focuses map without blocking dialog', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    let dialogSeen = false;
    page.once('dialog', () => {
      dialogSeen = true;
    });
    await page.locator('#nav-map-btn').click();
    await page.waitForTimeout(300);
    expect(dialogSeen).toBe(false);
  });

  test('index: Host & meet opens notes modal with hosting template', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#map .maplibregl-canvas, #map canvas', { timeout: 30000 });
    await page.waitForTimeout(500);
    await page.locator('#nav-host-btn').click();
    const modal = page.locator('#pluscode-notes-modal.active');
    await expect(modal).toBeVisible({ timeout: 20000 });
    const ta = page.locator('#note-content-in-modal');
    await expect(ta).toBeVisible();
    await expect(ta).toHaveValue(/Hosting travelers here/i);
  });

  test('index: Chats nav is active on #chat', async ({ page }) => {
    await page.goto('/#chat');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('body.nr-surface-chat', { timeout: 20000 });
    const conv = page.locator('#app-header a[href="#chat"]');
    await expect(conv).toHaveAttribute('aria-current', 'page');
  });
});
