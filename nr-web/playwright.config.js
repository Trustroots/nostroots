import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: resolve(__dirname, 'tests/e2e'),
  use: {
    baseURL: 'http://localhost:8080',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node tests/server.js',
    port: 8080,
    cwd: __dirname,
    reuseExistingServer: !process.env.CI,
  },
});
