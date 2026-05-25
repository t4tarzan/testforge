import { defineConfig } from '@playwright/test';

// E2E hits whatever URL BASE_URL points at — production by default, but CI
// overrides it with the PR's Vercel preview URL so tests block bad merges
// instead of catching them after promotion.
const baseURL = process.env.BASE_URL || 'https://testforge.run';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
