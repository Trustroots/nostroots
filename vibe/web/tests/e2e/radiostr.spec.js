import { test, expect } from './fixtures.js';

async function mockRadiostrRelay(page) {
  await page.addInitScript(() => {
    class MockWebSocket extends EventTarget {
      static OPEN = 1;

      constructor(url) {
        super();
        this.url = url;
        this.readyState = MockWebSocket.OPEN;
        setTimeout(() => {
          this.dispatchEvent(new Event('open'));
          const subID = 'radiostr-init-0';
          setTimeout(() => {
            this.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify(['EOSE', subID]),
            }));
          }, 0);
        }, 0);
      }

      send() {}

      close() {}
    }

    window.WebSocket = MockWebSocket;
  });
}

test.describe('Radiostr', () => {
  test('loads station list and shows chat hint without a signer', async ({ page }) => {
    await mockRadiostrRelay(page);
    await page.goto('/examples/radiostr/');

    await expect(page.locator('#now-playing-title')).toHaveText('Pick a station');
    await expect(page.locator('.station-btn')).toHaveCount(10);
    await expect(page.getByText('Groove Salad')).toBeVisible();
    await expect(page.locator('#chat-hint')).toContainText('Connect a Nostr key to chat');
    await expect(page.locator('#chat-input')).toBeDisabled();
  });

  test('tune-in updates hash when selecting a station', async ({ page }) => {
    await mockRadiostrRelay(page);
    await page.goto('/examples/radiostr/');

    await page.getByRole('button', { name: 'Groove Salad' }).click();
    await expect(page).toHaveURL(/#groovesalad$/);
    await expect(page.locator('#now-playing-title')).toHaveText('Groove Salad');
    await expect(page.locator('#play-btn')).toHaveText('Pause');
  });
});
