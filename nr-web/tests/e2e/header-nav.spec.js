import { test, expect } from './fixtures.js';

async function openUserMenuIfNeeded(page) {
  const settingsBtn = page.locator('#settings-icon-btn');
  if (await settingsBtn.isVisible()) return;
  const menuBtn = page.locator('#nav-user-btn');
  if (await menuBtn.isVisible()) {
    await menuBtn.click();
    await page.waitForTimeout(200);
  }
}

test.describe('Header navigation', () => {
  test('index: main nav items and Conversations link', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const header = page.locator('#app-header');
    await expect(header.locator('#nav-support-btn')).toBeVisible();
    await expect(header.getByRole('link', { name: 'Conversations' })).toBeVisible();
    await expect(header.locator('#nav-map-btn')).toBeVisible();
    await expect(header.locator('#nav-host-btn')).toBeVisible();
    await expect(header.locator('#nav-user-btn')).toBeVisible();
    const conv = header.getByRole('link', { name: 'Conversations' });
    await expect(conv).toHaveAttribute('href', /chat\.html$/);
    await expect(header.locator('a[href="index.html"].app-header-logo-link')).toBeAttached();
    await expect(header.locator('[data-nav="nostroots"]')).toHaveCount(0);
  });

  test('index: Support dropdown opens and Help triggers help modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('#nav-support-btn').click();
    await expect(page.locator('#nav-support-help-btn')).toBeVisible();
    await page.locator('#nav-support-help-btn').click();
    await expect(page.locator('#help-modal.active')).toBeVisible({ timeout: 3000 });
    await page.locator('#help-modal .modal-close').first().click();
    await expect(page.locator('#help-modal')).not.toBeVisible();
  });

  test('index: Account menu opens and Settings control is reachable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await openUserMenuIfNeeded(page);
    await expect(page.locator('#settings-icon-btn')).toBeVisible();
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

  test('index: Host opens notes modal with hosting template', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);
    await page.locator('#nav-host-btn').click();
    const modal = page.locator('#pluscode-notes-modal.active');
    await expect(modal).toBeVisible({ timeout: 20000 });
    const ta = page.locator('#note-content-in-modal');
    await expect(ta).toBeVisible();
    await expect(ta).toHaveValue(/Hosting travelers here/i);
  });

  test('chat: Conversations nav is active', async ({ page }) => {
    await page.goto('/chat.html');
    await page.waitForLoadState('networkidle');
    const conv = page.locator('#app-header a[href="chat.html"]');
    await expect(conv).toHaveAttribute('aria-current', 'page');
  });
});
