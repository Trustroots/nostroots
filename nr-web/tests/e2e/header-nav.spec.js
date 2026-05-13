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

async function clickVisible(first, second) {
  if (await first.isVisible()) {
    await first.click();
    return true;
  }
  if (await second.isVisible()) {
    await second.click();
    return true;
  }
  return false;
}

async function expectAnyVisible(...locators) {
  for (const loc of locators) {
    if (await loc.isVisible()) return;
  }
  throw new Error('Expected at least one locator to be visible');
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
  test('index: main nav items are ordered Map, Host & Meet, Chat', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const header = page.locator('#app-header');
    await expectAnyVisible(header.locator('#nav-support-btn'), header.locator('#nav-more-btn'));
    await expect(header.locator('#nav-map-btn')).toBeVisible();
    await expect(header.getByRole('button', { name: 'Host & Meet' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Chat' })).toBeVisible();
    await expectAnyVisible(header.locator('#nav-user-btn'), header.locator('#nav-more-btn'));
    const relayStatus = header.locator('#header-relay-status');
    await expect(relayStatus).toBeVisible();
    await expect(relayStatus.locator('.header-relay-status-value')).toHaveText(/^(--|\d+\/\d+)$/);
    const visibleNavLabels = await header.locator('.nr-nav-main > .nr-nav-link:visible .nr-nav-link-text').allTextContents();
    expect(visibleNavLabels.slice(0, 3)).toEqual(['Map', 'Host & Meet', 'Chat']);
    const conv = header.getByRole('link', { name: 'Chat' });
    await expect(conv).toHaveAttribute('href', '#chat');
    await expect(header.locator('a[href="#"].app-header-logo-link')).toBeAttached();
    await expect(header.locator('[data-nav="nostroots"]')).toHaveCount(0);
  });

  test('index: relay status pill opens relay settings', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const relayStatus = page.locator('#app-header #header-relay-status');
    await expect(relayStatus).toBeVisible();
    await expect(relayStatus.locator('.header-relay-status-value')).toHaveText(/^(--|\d+\/\d+)$/);
    await relayStatus.click();
    await expect(page).toHaveURL(/#settings\/relays\b/);
    await expect(page.locator('#settings-modal.active')).toBeVisible();
    await expect(page.locator('#relays-list')).toBeVisible();
  });

  test('index: stats route renders and is linked from the account menu', async ({ page }) => {
    await page.goto('/#stats');
    await expect(page.locator('body.nr-surface-stats')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Progress stats' })).toBeVisible();
    await expect(page.locator('#nav-map-btn')).not.toHaveAttribute('aria-current', 'page');

    await page.locator('#nav-map-btn').click();
    await expect(page.locator('body.nr-surface-stats')).toHaveCount(0);
    await expect(page.locator('#map-view')).toBeVisible();
    await expect(page).not.toHaveURL(/#stats\b/);

    await page.goto('/');
    await openUserMenuIfNeeded(page);
    const statsLink = page.getByRole('menuitem', { name: 'Progress stats' }).first();
    await expect(statsLink).toBeVisible();
    await expect(statsLink).toHaveAttribute('href', '#stats');
    await statsLink.click();
    await expect(page).toHaveURL(/#stats\b/);
  });

  test('index: settings KPI chips render and wire map/settings actions', async ({ page }) => {
    await page.goto('/#settings');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#settings-modal.active')).toBeVisible();

    const settingsKpis = page.locator('#settings-kpis');
    await expect(settingsKpis.locator('#kpi-new-notes-24h')).toBeVisible();
    await expect(settingsKpis.locator('#kpi-notes-loaded')).toBeVisible();
    await expect(settingsKpis.locator('#kpi-subscribed-areas')).toBeVisible();
    await expect(settingsKpis.locator('#kpi-relays-online')).toBeVisible();

    await settingsKpis.locator('#kpi-new-notes-24h').click();
    await page.waitForTimeout(200);
    await expect(page.locator('#nav-map-btn')).toHaveAttribute('aria-current', 'page');

    await page.goto('/#settings');
    await page.waitForLoadState('networkidle');
    await page.locator('#settings-kpis #kpi-subscribed-areas').click();
    await expect(page).toHaveURL(/#settings\b/);
    await expect(page.locator('#settings-notifications-section')).toBeVisible();

    await page.goto('/#settings');
    await page.waitForLoadState('networkidle');
    await page.locator('#settings-kpis #kpi-relays-online').click();
    await expect(page).toHaveURL(/#settings\/relays\b/);
    await expect(page.locator('#relays-list')).toBeVisible();
  });

  test('index: compact mobile keeps all four KPI chips in settings', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 900 });
    await page.goto('/#settings');
    await page.waitForLoadState('networkidle');

    const settingsKpis = page.locator('#settings-kpis');
    await expect(settingsKpis.locator('#kpi-new-notes-24h')).toBeVisible();
    await expect(settingsKpis.locator('#kpi-notes-loaded')).toBeVisible();
    await expect(settingsKpis.locator('#kpi-subscribed-areas')).toBeVisible();
    await expect(settingsKpis.locator('#kpi-relays-online')).toBeVisible();
  });

  test('index: Support dropdown opens and Support chat goes to #support', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const supportBtn = page.locator('#nav-support-btn');
    const moreBtn = page.locator('#nav-more-btn');
    let supportChat;
    if (await supportBtn.isVisible()) {
      await supportBtn.click();
      await expect(page.locator('#nav-support-menu')).toBeVisible();
      supportChat = page.locator('#nav-support-menu a[href="#support"]').first();
    } else {
      await moreBtn.click();
      await expect(page.locator('#nav-more-menu')).toBeVisible();
      supportChat = page.locator('#nav-more-menu a[href="#support"]').first();
    }
    await expect(supportChat).toBeVisible();
    await expect(supportChat).toHaveAttribute('href', '#support');
    await expect(supportChat).toHaveText('Support chat');
    await supportChat.click();
    await expect(page).toHaveURL(/#support\b/);
    await expect(page.locator('body.nr-surface-chat')).toBeVisible({ timeout: 20000 });
    await expect(page).toHaveTitle('Nostroots #support');
  });

  test('index: Account menu opens and Settings control is reachable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await openUserMenuIfNeeded(page);
    const settingsBtn = page.locator('#settings-icon-btn');
    const settingsBtnMobile = page.locator('#settings-icon-btn-mobile');
    if (!(await settingsBtn.isVisible()) && !(await settingsBtnMobile.isVisible())) {
      await clickVisible(page.locator('#nav-user-btn'), page.locator('#nav-more-btn'));
    }
    await expectAnyVisible(settingsBtn, settingsBtnMobile);
    await clickVisible(settingsBtn, settingsBtnMobile);
    await expect(page).toHaveURL(/#settings\b/);
    await expect(page).toHaveTitle('Nostroots Settings');
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

  test('index: Host & meet opens Host & Meet area page with hosting intent selected', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#map .maplibregl-canvas, #map canvas', { timeout: 30000 });
    await page.waitForTimeout(500);
    await page.locator('#nav-host-btn').click();
    await expect(page.locator('body.nr-surface-host')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#map-view')).not.toBeVisible();
    await expect(page.locator('#nav-host-btn')).toHaveClass(/is-active/);
    await expect(page.locator('#nav-host-btn')).toHaveAttribute('aria-current', 'page');
    const areaPage = page.locator('#nr-host-view');
    await expect(areaPage).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#pluscode-notes-modal .area-main')).toBeVisible();
    await expect(page.locator('#pluscode-notes-modal .area-sidebar')).toBeVisible();
    await expect(page.locator('#pluscode-notes-modal .area-thread')).toBeVisible();
    await expect(page.locator('#pluscode-notes-title')).toHaveText('Host & Meet');
    await expect(page.locator('#area-location-code')).not.toHaveText('');
    const ta = page.locator('#note-content-in-modal');
    await expect(ta).toBeVisible();
    // The hosting flow now starts with an empty textarea and the hosting intent chip pre-selected.
    const hostingChip = page.locator('#note-intent-chips [data-intent="hosting"]');
    await expect(hostingChip).toBeVisible();
    await expect(hostingChip).toHaveAttribute('aria-checked', 'true');
  });

  test('index: Host & meet prefers browser location over stale map center', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 38.72, longitude: -9.14 });

    await page.addInitScript(() => {
      try {
        localStorage.setItem('map_center', JSON.stringify([31.5, 34.5]));
        localStorage.setItem('map_zoom', '2');
      } catch (_) {}
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#map .maplibregl-canvas, #map canvas', { timeout: 30000 });

    await page.locator('#nav-host-btn').click();
    await expect(page.locator('body.nr-surface-host')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#nav-host-btn')).toHaveClass(/is-active/);
    await expect(page.locator('#area-location-code')).toHaveText('8CCGPV00+');
    await expect(page).toHaveURL(/#8CCGPV00\+/);
  });

  test('index: Host & meet does not flash back to map from Chats', async ({ page }) => {
    await page.goto('/#chat');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('body.nr-surface-chat', { timeout: 20000 });

    await page.locator('#nav-host-btn').click();

    await expect(page.locator('body.nr-surface-host')).toBeVisible();
    await expect(page.locator('#map-view')).not.toBeVisible();
    await expect(page.locator('#nav-host-btn')).toHaveClass(/is-active/);
    await expect(page.locator('#nav-host-btn')).toHaveAttribute('aria-current', 'page');
  });

  test('index: Chat nav returns to the last concrete chat route from Host & Meet', async ({ page }) => {
    await page.goto('/#hackers');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('body.nr-surface-chat', { timeout: 20000 });

    await page.locator('#nav-host-btn').click();
    await expect(page.locator('body.nr-surface-host')).toBeVisible({ timeout: 20000 });
    const chatLink = page.locator('#app-header').getByRole('link', { name: 'Chat' });
    await expect(chatLink).toHaveAttribute('href', '#hackers');

    await chatLink.click();
    await expect(page.locator('body.nr-surface-chat')).toBeVisible({ timeout: 20000 });
    await expect(page).toHaveURL(/#hackers$/);
  });

  test('index: Chat nav is active on #chat', async ({ page }) => {
    await page.goto('/#chat');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('body.nr-surface-chat', { timeout: 20000 });
    const conv = page.locator('#app-header a[href="#chat"]');
    await expect(conv).toHaveAttribute('aria-current', 'page');
  });
});
