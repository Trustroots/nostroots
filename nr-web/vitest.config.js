import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: 'https://cdn.jsdelivr.net/npm/nostr-tools@2.23.0/+esm',
        replacement: 'nostr-tools',
      },
      {
        find: 'https://cdn.jsdelivr.net/npm/bip39@3.1.0/+esm',
        replacement: 'bip39',
      },
      {
        find: 'https://cdn.jsdelivr.net/npm/dompurify@3.2.2/+esm',
        replacement: 'dompurify',
      },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [resolve(__dirname, 'tests/setup.js')],
    testTimeout: 10000,
    // Exclude E2E tests - those are run by Playwright
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/tests/e2e/**',
      '**/*.e2e.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
  },
});
