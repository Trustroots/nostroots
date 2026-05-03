import { test, expect } from './fixtures.js';

function settingsMenuBtn(page) {
  // Desktop + mobile can both be in the DOM and visible; strict mode rejects bare `.or()`.
  return page.locator('#settings-icon-btn').or(page.locator('#settings-icon-btn-mobile')).first();
}

/** Keys / Settings live in the Account or mobile “more” menu in the shared header */
async function openUserMenuIfNeeded(page) {
  const settingsBtn = settingsMenuBtn(page);
  if (await settingsBtn.isVisible()) return;
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

test.describe('Settings Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Generate a key first so we can access settings
    const hasKey = await page.evaluate(() => {
      return !!localStorage.getItem('nostr_private_key');
    });
    
    if (!hasKey) {
      // Generate key via onboarding
      const generateBtn = page.locator('button[onclick="onboardingGenerate()"]');
      if (await generateBtn.isVisible()) {
        await generateBtn.click();
        await page.waitForTimeout(1000); // Wait for key generation
      }
    }
    
    // Close keys modal using JavaScript (clicking doesn't work because modal intercepts pointer events)
    await page.evaluate(() => {
      const keysModal = document.getElementById('keys-modal');
      if (keysModal) {
        keysModal.classList.remove('active');
        keysModal.style.display = 'none';
      }
    });
    await page.waitForTimeout(200);
  });

  test('can open settings modal', async ({ page }) => {
    await openUserMenuIfNeeded(page);
    const settingsBtn = page.locator('#settings-icon-btn');
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      
      const settingsModal = page.locator('#settings-modal');
      await expect(settingsModal).toBeVisible({ timeout: 2000 });
    } else {
      // Settings button might not be visible if no key
      test.skip();
    }
  });

  test('settings modal has relays section', async ({ page }) => {
    await openUserMenuIfNeeded(page);
    const settingsBtn = page.locator('#settings-icon-btn');
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      
      const settingsModal = page.locator('#settings-modal');
      await expect(settingsModal).toBeVisible();
      
      // Check for relay-related elements (relays are now in settings modal)
      const relaysList = page.locator('#relays-list');
      const newRelayInput = page.locator('#new-relay-url');
      
      // Both should be present
      await expect(relaysList).toBeAttached();
      await expect(newRelayInput).toBeAttached();
    } else {
      test.skip();
    }
  });

  test('can add new relay URL', async ({ page }) => {
    await openUserMenuIfNeeded(page);
    const settingsBtn = page.locator('#settings-icon-btn');
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      
      const settingsModal = page.locator('#settings-modal');
      await expect(settingsModal).toBeVisible();
      
      // New relay input field (relays are now added individually)
      const newRelayInput = page.locator('#new-relay-url');
      if (await newRelayInput.isVisible()) {
        const testRelay = 'wss://test-relay1.com';
        await newRelayInput.fill(testRelay);
        
        const value = await newRelayInput.inputValue();
        expect(value).toContain('test-relay1.com');
      }
    } else {
      test.skip();
    }
  });

  test('keys modal has username linking section', async ({ page }) => {
    // Username input is now in the keys modal - reopen it
    await page.evaluate(() => {
      const keysModal = document.getElementById('keys-modal');
      if (keysModal) {
        keysModal.classList.add('active');
        keysModal.style.display = 'flex';
      }
    });
    
    const keysModal = page.locator('#keys-modal');
    await expect(keysModal).toBeVisible();
    
    const usernameInput = page.locator('#trustroots-username');
    await expect(usernameInput).toBeAttached();
  });

  test('settings modal has notifications section', async ({ page }) => {
    await openUserMenuIfNeeded(page);
    const settingsBtn = page.locator('#settings-icon-btn');
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();

      const settingsModal = page.locator('#settings-modal');
      await expect(settingsModal).toBeVisible();

      const notificationsSection = page.locator('#settings-notifications-section');
      await expect(notificationsSection).toBeAttached();
      await expect(notificationsSection).toContainText('Notifications');
      await expect(notificationsSection).toContainText('Permission:');
    } else {
      test.skip();
    }
  });

  test('settings modal shows commit and deploy metadata', async ({ page }) => {
    await openUserMenuIfNeeded(page);
    const settingsBtn = page.locator('#settings-icon-btn');
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();

      const settingsModal = page.locator('#settings-modal');
      await expect(settingsModal).toBeVisible();

      const commitMeta = page.locator('#settings-last-commit-datetime');
      const deployMeta = page.locator('#settings-last-deploy-datetime');
      await expect(commitMeta).toBeAttached();
      await expect(deployMeta).toBeAttached();

      await expect.poll(async () => {
        const value = (await commitMeta.textContent() || '').trim();
        return value;
      }).toMatch(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}|unavailable)$/);

      await expect.poll(async () => {
        const value = (await deployMeta.textContent() || '').trim();
        return value;
      }).toMatch(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}|unavailable)$/);
    } else {
      test.skip();
    }
  });

  test('defaults to light theme and can persist dark mode from settings', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('nrweb_theme');
      localStorage.removeItem('nrweb_theme_ts');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    const themeDefault = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(themeDefault).toBe('light');

    const hasKey = await page.evaluate(() => !!localStorage.getItem('nostr_private_key'));
    if (!hasKey) {
      const generateBtn = page.locator('button[onclick="onboardingGenerate()"]');
      if (await generateBtn.isVisible()) {
        await generateBtn.click();
        await page.waitForTimeout(500);
      }
    }

    await page.evaluate(() => {
      const keysModal = document.getElementById('keys-modal');
      if (keysModal) {
        keysModal.classList.remove('active');
        keysModal.style.display = 'none';
      }
    });

    await openUserMenuIfNeeded(page);
    const settingsBtn = page.locator('#settings-icon-btn');
    if (!(await settingsBtn.isVisible())) {
      test.skip();
    }

    await settingsBtn.click();
    const settingsModal = page.locator('#settings-modal');
    await expect(settingsModal).toBeVisible();
    // Checkbox is visually hidden (opacity 0); toggle via the switch label the user actually clicks.
    await settingsModal.locator('label.toggle-switch').click();

    const afterDark = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(afterDark).toBe('dark');
    const stored = await page.evaluate(() => localStorage.getItem('nrweb_theme'));
    expect(stored).toBe('dark');

    await page.reload();
    await page.waitForLoadState('networkidle');
    const afterReload = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(afterReload).toBe('dark');
  });

  test('can close settings modal', async ({ page }) => {
    await openUserMenuIfNeeded(page);
    const settingsBtn = page.locator('#settings-icon-btn');
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      
      const settingsModal = page.locator('#settings-modal');
      await expect(settingsModal).toBeVisible();
      
      // Try to close with close button
      const closeBtn = settingsModal.locator('.modal-close');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await expect(settingsModal).not.toBeVisible({ timeout: 1000 });
      }
    } else {
      test.skip();
    }
  });
});
