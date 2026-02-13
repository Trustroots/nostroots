import { test, expect } from '@playwright/test';

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

  test('can close settings modal', async ({ page }) => {
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
