import { defineConfig } from '@playwright/test';

// E2E hits whatever URL BASE_URL points at — production by default, but CI
// overrides it with the PR's Vercel preview URL so tests block bad merges
// instead of catching them after promotion.
const baseURL = process.env.BASE_URL || 'https://testforge.run';

// Vercel Deployment Protection (SSO) gates preview deploys behind a login
// page. To run Playwright against them, generate a "Protection Bypass for
// Automation" secret in the Vercel project (Settings → Deployment Protection
// → Add Secret) and expose it as VERCEL_AUTOMATION_BYPASS_SECRET. We send it
// as a header on every HTTP request and set the same cookie for browser
// navigations so the Vercel edge accepts them without redirecting to SSO.
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const extraHTTPHeaders = bypassSecret
  ? { 'x-vercel-protection-bypass': bypassSecret }
  : undefined;

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
    extraHTTPHeaders,
    // Also stash the bypass as a cookie so SPA route changes and any
    // browser-initiated navigations don't fall back to the SSO redirect.
    storageState: bypassSecret
      ? {
          cookies: [
            {
              name: '__vercel_protection_bypass',
              value: bypassSecret,
              domain: new URL(baseURL).hostname,
              path: '/',
              expires: -1,
              httpOnly: false,
              secure: true,
              sameSite: 'Lax',
            },
          ],
          origins: [],
        }
      : undefined,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
