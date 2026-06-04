import { test, expect } from './fixtures.js';

test.describe('Nostroots Web hub', () => {
  test('shows both web experiences', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Choose your path.' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Open Trustroots Map/ })).toHaveAttribute('href', 'trustroots-map/');
    await expect(page.getByRole('link', { name: /Open Nostrail/ })).toHaveAttribute('href', 'nostrail/');
    await expect(page.getByRole('link', { name: /Open Nostroots Map/ })).toHaveAttribute('href', 'nostroots-map/');
  });

  test('redirects legacy hash routes to Trustroots Map', async ({ page }) => {
    await page.goto('/#stats');

    await expect(page).toHaveURL(/\/trustroots-map\/#stats$/);
  });

  test('redirects legacy query shortcuts to Trustroots Map', async ({ page }) => {
    await page.goto('/?welcome=1');

    await expect(page).toHaveURL(/\/trustroots-map\/\?welcome=1/);
  });
});
