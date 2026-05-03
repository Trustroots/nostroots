/**
 * Playwright fixtures: wait for the main index module to expose globals before
 * assertions (WebKit can report load/network idle before ES module init finishes).
 */
import { test as base, expect } from '@playwright/test';

function pathnameFromGotoUrl(url) {
  if (typeof url !== 'string') return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      return new URL(url).pathname || '';
    } catch {
      return '';
    }
  }
  return url.startsWith('/') ? url : `/${url}`;
}

function isIndexMapPage(pathname) {
  return pathname === '/' || pathname.endsWith('/index.html');
}

export const test = base.extend({
  page: async ({ page }, use) => {
    const originalGoto = page.goto.bind(page);
    page.goto = async function patchedGoto(url, options) {
      const res = await originalGoto(url, {
        waitUntil: 'load',
        ...(options || {}),
      });
      const pathname = pathnameFromGotoUrl(url);
      if (isIndexMapPage(pathname)) {
        await page.waitForFunction(
          () =>
            typeof window.openHostNoteFlow === 'function' &&
            typeof window.openHelpModal === 'function' &&
            typeof window.isEventExpired === 'function',
          { timeout: 120000 },
        );
      }
      return res;
    };
    await use(page);
  },
});

export { expect };
