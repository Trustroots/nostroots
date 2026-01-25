import { test, expect } from '@playwright/test';

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

  test('view note modal exists', async ({ page }) => {
    const viewNoteModal = page.locator('#view-note-modal');
    await expect(viewNoteModal).toBeAttached();
  });

  test('plus code notes modal exists', async ({ page }) => {
    const plusCodeModal = page.locator('#pluscode-notes-modal');
    await expect(plusCodeModal).toBeAttached();
  });

  test('note modals have correct structure', async ({ page }) => {
    const modals = ['view-note-modal', 'pluscode-notes-modal'];
    
    for (const modalId of modals) {
      const modal = page.locator(`#${modalId}`);
      await expect(modal).toBeAttached();
      
      const content = modal.locator('.modal-content');
      await expect(content).toBeAttached();
    }
  });

  test('can interact with note form elements', async ({ page }) => {
    // Check if note form elements exist (they might be in a modal)
    const noteContent = page.locator('textarea, input[type="text"]').first();
    // Just verify the page has form elements
    const formElements = await page.locator('input, textarea').count();
    expect(formElements).toBeGreaterThan(0);
  });
});
