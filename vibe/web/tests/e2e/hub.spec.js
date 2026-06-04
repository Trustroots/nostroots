import { test, expect } from './fixtures.js';

test.describe('Nostroots Web hub', () => {
  test('shows stable options by default and reveals experimental apps on request', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Choose where to continue.' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Edit Trustroots Networks/ })).toHaveAttribute('href', 'https://www.trustroots.org/profile/edit/networks');
    await expect(page.getByRole('link', { name: /Open Trustroots on Nostr/ })).toHaveAttribute('href', 'trustroots-map/');

    const experimentalToggle = page.getByRole('checkbox', { name: 'Show experimental apps' });
    await expect(experimentalToggle).not.toBeChecked();
    await expect(page.getByRole('link', { name: /Open Nostrail/ })).toBeHidden();
    await expect(page.getByRole('link', { name: /Open Nostroots Map/ })).toBeHidden();

    await experimentalToggle.check();

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
