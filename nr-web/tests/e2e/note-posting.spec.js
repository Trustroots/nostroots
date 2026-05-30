import { test, expect } from './fixtures.js';

test.describe('Note Posting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Generate a key if needed
    const hasKey = await page.evaluate(() => {
      return !!localStorage.getItem('nostr_private_key');
    });
    
    if (!hasKey) {
      // Use onboarding button specifically
      const generateBtn = page.locator('button[onclick="onboardingGenerate()"]');
      if (await generateBtn.isVisible()) {
        await generateBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('note input elements exist', async ({ page }) => {
    // Check for note content input (might be in pluscode modal)
    const noteContent = page.locator('#note-content-in-modal');
    await expect(noteContent).toBeAttached();
  });

  test('Host & Meet page shell exists', async ({ page }) => {
    await expect(page.locator('#nr-host-view')).toBeAttached();
    await expect(page.locator('#pluscode-notes-modal')).toBeAttached();
  });

  test('Host & Meet page has correct structure', async ({ page }) => {
    const host = page.locator('#nr-host-view');
    await expect(host).toBeAttached();
    await expect(host.locator('.host-page-content')).toBeAttached();
    await expect(host.locator('.area-sidebar')).toBeAttached();
    await expect(host.locator('.area-thread')).toBeAttached();
  });

  test('can interact with note form elements', async ({ page }) => {
    // Check if note form elements exist (they might be in a modal)
    const noteContent = page.locator('textarea, input[type="text"]').first();
    // Just verify the page has form elements
    const formElements = await page.locator('input, textarea').count();
    expect(formElements).toBeGreaterThan(0);
  });
});
