import { test, expect } from '@playwright/test';

test.describe('Basic Page Load', () => {
  test('page loads and displays title', async ({ page }) => {
    await page.goto('/');
    
    // Check page title
    await expect(page).toHaveTitle(/Nostroots Web/);
  });

  test('page has main content', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Check that body exists and has content
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Check that the page has some expected elements
    // (adjust based on actual page structure)
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'en');
  });

  test('page loads without JavaScript errors', async ({ page }) => {
    const errors = [];
    
    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Listen for page errors
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Filter out known non-critical errors (like CDN load failures in test env)
    const criticalErrors = errors.filter(err => 
      !err.includes('Failed to load resource') &&
      !err.includes('CORS') &&
      !err.includes('net::ERR')
    );
    
    // In a real test environment, CDN resources might fail to load
    // This is expected and not a critical error for basic functionality
    expect(criticalErrors.length).toBe(0);
  });
});
