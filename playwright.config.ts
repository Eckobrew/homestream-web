import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 30000,
  webServer: process.env.HOMESTREAM_E2E_URL ? undefined : { command: 'node scripts/e2e-stack.mjs', url: 'http://127.0.0.1:3300/health', timeout: 60000 },
  use: { baseURL: process.env.HOMESTREAM_E2E_URL || 'http://127.0.0.1:3300', headless: true, trace: 'retain-on-failure' },
});
