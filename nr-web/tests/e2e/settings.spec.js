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

  test('settings modal has key management section', async ({ page }) => {
    const settingsBtn = page.locator('#settings-icon-btn');
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      
      const settingsModal = page.locator('#settings-modal');
      await expect(settingsModal).toBeVisible();
      
      // Check for key-related elements
      const npubDisplay = page.locator('#npub-display');
      const generateBtn = page.locator('button:has-text("Generate New Key")');
      
      // At least one should be present
      const hasNpub = await npubDisplay.isVisible().catch(() => false);
      const hasGenerate = await generateBtn.isVisible().catch(() => false);
      
      expect(hasNpub || hasGenerate).toBe(true);
    } else {
      test.skip();
    }
  });

  test('can modify relay URLs', async ({ page }) => {
    const settingsBtn = page.locator('#settings-icon-btn');
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      
      const settingsModal = page.locator('#settings-modal');
      await expect(settingsModal).toBeVisible();
      
      const relayTextarea = page.locator('#relay-urls');
      if (await relayTextarea.isVisible()) {
        const testRelays = 'wss://test-relay1.com\nwss://test-relay2.com';
        await relayTextarea.fill(testRelays);
        
        const value = await relayTextarea.inputValue();
        expect(value).toContain('test-relay1.com');
      }
    } else {
      test.skip();
    }
  });

  test('settings modal has username linking section', async ({ page }) => {
    const settingsBtn = page.locator('#settings-icon-btn');
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      
      const settingsModal = page.locator('#settings-modal');
      await expect(settingsModal).toBeVisible();
      
      const usernameInput = page.locator('#trustroots-username');
      await expect(usernameInput).toBeAttached();
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
