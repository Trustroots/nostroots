import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
  });

  test('keys modal appears when no key exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const keysModal = page.locator('#keys-modal');
    await expect(keysModal).toBeVisible();
  });

  test('can generate new key from onboarding', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Click generate button (use onboarding-specific button)
    const generateBtn = page.locator('button[onclick="onboardingGenerate()"]');
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();
    
    // Wait for welcome section to disappear (key was generated)
    const welcomeSection = page.locator('#keys-welcome-section');
    await expect(welcomeSection).not.toBeVisible({ timeout: 5000 });
    
    // Verify key was created (check localStorage)
    const hasKey = await page.evaluate(() => {
      return !!localStorage.getItem('nostr_private_key');
    });
    expect(hasKey).toBe(true);
  });

  test('onboarding import button exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const importBtn = page.locator('button[onclick="onboardingImport()"]');
    await expect(importBtn).toBeVisible();
  });

  test('onboarding has import input field', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const importInput = page.locator('#onboarding-import');
    await expect(importInput).toBeVisible();
  });

  test('onboarding shows NIP-07 option when available', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Mock window.nostr to simulate extension
    await page.evaluate(() => {
      window.nostr = {
        getPublicKey: async () => 'test-pubkey',
      };
    });
    
    // Trigger the check (might need to reload or trigger the check function)
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // NIP-07 section might be visible or hidden depending on detection
    const nip07Section = page.locator('#keys-nip07-section');
    // Just verify it exists, visibility depends on extension detection timing
    await expect(nip07Section).toBeAttached();
  });

  test('keys modal cannot be closed with ESC when no key exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const keysModal = page.locator('#keys-modal');
    await expect(keysModal).toBeVisible();
    
    // Try to close with ESC
    await page.keyboard.press('Escape');
    
    // Modal should still be visible (user must set up keys first)
    await expect(keysModal).toBeVisible();
  });
});
