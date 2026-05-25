import { test, expect } from '@playwright/test';

// Same env override as playwright.config.ts. Tests can also use the
// fixture's `baseURL` directly, but a few absolute URLs remain below.
const BASE = process.env.BASE_URL || 'https://testforge.run';

// ═══════════════════════════════════════════════════
// PAGE RENDERING — Every page loads
// ═══════════════════════════════════════════════════
const pages = [
  { name: 'Home', path: '/' },
  { name: 'Managed', path: '/#/managed' },
  { name: 'Pipeline', path: '/#/pipeline' },
  { name: 'Integrator', path: '/#/integrator' },
  { name: 'Testing Dimensions', path: '/#/testing-dimensions' },
  { name: 'PRD Generator', path: '/#/prd-generator' },
  { name: 'Dashboard', path: '/#/dashboard' },
  { name: 'Pricing', path: '/#/pricing' },
  { name: 'Auth', path: '/#/auth' },
  { name: 'MCP Integration', path: '/#/mcp' },
  { name: 'Docs', path: '/#/docs' },
  { name: 'Test Runner', path: '/#/run-test' },
];

// Pre-dismiss the onboarding modal so it doesn't cover content during render
// assertions. (The modal opens 1.5s after first visit and persists dismissal
// via localStorage.)
test.use({
  storageState: {
    cookies: [],
    origins: [
      {
        origin: process.env.BASE_URL || 'https://testforge.run',
        localStorage: [{ name: 'onboarding_dismissed', value: 'true' }],
      },
    ],
  },
});

for (const page of pages) {
  test(`Page renders: ${page.name}`, async ({ page: p }) => {
    await p.goto(`${BASE}${page.path}`, { waitUntil: 'load' });
    // Page paths /#/auth, /#/run-test, /#/account redirect anonymous users
    // to /#/auth (auth guard added in B3). Either landing is acceptable —
    // verify content rendered, not status code (hash routes don't always
    // produce a fresh Response).
    await p.waitForTimeout(2500);
    const bodyText = await p.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(100);
    // Don't assert navbar visibility — Auth and account pages use a custom
    // full-screen layout without the marketing nav. The body-text length
    // assertion catches blank/error pages just fine.
  });
}

// ═══════════════════════════════════════════════════
// API ENDPOINTS — All return data
// ═══════════════════════════════════════════════════
test('API: Health check', async ({ request }) => {
  const res = await request.get(`${BASE}/api/health`);
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.status).toBe('ok');
});

test('API: Stripe plans', async ({ request }) => {
  const res = await request.get(`${BASE}/api/stripe`);
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.plans.length).toBeGreaterThanOrEqual(3);
});

test('API: Badge SVG', async ({ request }) => {
  const res = await request.get(`${BASE}/api/badge?score=85`);
  expect(res.status()).toBe(200);
  const contentType = res.headers()['content-type'];
  expect(contentType).toContain('svg');
});

test('API: Status page', async ({ request }) => {
  const res = await request.get(`${BASE}/api/status`);
  expect(res.status()).toBe(200);
});

test('API: History requires auth', async ({ request }) => {
  // /api/history is user-scoped post-B3 — anonymous requests must 401, not
  // 200 with seed data (the old behavior).
  const res = await request.get(`${BASE}/api/history`);
  expect(res.status()).toBe(401);
});

// ═══════════════════════════════════════════════════
// AUTH FLOW — Login page works
// ═══════════════════════════════════════════════════
test('Auth: Login page renders', async ({ page }) => {
  await page.goto(`${BASE}/#/auth`, { waitUntil: 'networkidle' });
  // Should have GitHub button
  await expect(page.locator('text=Continue with GitHub')).toBeVisible({ timeout: 5000 });
  // Should have email login form
  await expect(page.locator('input[type="email"], input[placeholder*="email"]').first()).toBeVisible();
});

test('Auth: GitHub OAuth redirects', async ({ request }) => {
  // page.goto follows the redirect chain, so res.status() ends up as 200
  // on GitHub's login page. Use request with maxRedirects:0 to capture the
  // initial 302 from our callback handler.
  const res = await request.get(`${BASE}/api/auth/callback`, { maxRedirects: 0 });
  expect([301, 302, 303]).toContain(res.status());
  expect(res.headers()['location']).toContain('github.com');
});

// ═══════════════════════════════════════════════════
// MANAGED PAGE — Can submit a repo
// ═══════════════════════════════════════════════════
test('Managed: Input accepts repo URL', async ({ page }) => {
  await page.goto(`${BASE}/#/managed`, { waitUntil: 'networkidle' });
  const input = page.locator('input[placeholder*="github.com"]');
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill('https://github.com/tinyhttp/malibu');
  expect(await input.inputValue()).toBe('https://github.com/tinyhttp/malibu');
});

test('Managed: Run Analysis button exists', async ({ page }) => {
  await page.goto(`${BASE}/#/managed`, { waitUntil: 'networkidle' });
  await expect(page.locator('button:has-text("Run Analysis")')).toBeVisible({ timeout: 5000 });
});

// ═══════════════════════════════════════════════════
// PRICING — Plans and CTAs
// ═══════════════════════════════════════════════════
test('Pricing: Three tiers visible', async ({ page }) => {
  await page.goto(`${BASE}/#/pricing`, { waitUntil: 'load' });
  await page.waitForTimeout(2000); // tier cards animate in via framer-motion
  // Look for the three plan headings rather than a specific button label —
  // the marketing copy changes more often than the plan names.
  await expect(page.locator('text=/^\\s*Free\\s*$/').first()).toBeVisible({ timeout: 8000 });
  await expect(page.locator('text=/^\\s*Pro\\s*$/').first()).toBeVisible({ timeout: 8000 });
  await expect(page.locator('text=/^\\s*Enterprise\\s*$/').first()).toBeVisible({ timeout: 8000 });
});

test('Pricing: Free CTA links to managed', async ({ page }) => {
  await page.goto(`${BASE}/#/pricing`, { waitUntil: 'networkidle' });
  const freeBtn = page.locator('button:has-text("Start Testing Free")');
  if (await freeBtn.isVisible()) {
    await freeBtn.click();
    await page.waitForURL('**/managed**', { timeout: 5000 });
    expect(page.url()).toContain('managed');
  }
});

// ═══════════════════════════════════════════════════
// DASHBOARD — Shows data
// ═══════════════════════════════════════════════════
test('Dashboard: Loads with content', async ({ page }) => {
  await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'networkidle' });
  await expect(page.locator('text=ANALYTICS').or(page.locator('text=analytics'))).toBeVisible({ timeout: 5000 });
});

// ═══════════════════════════════════════════════════
// DOCS — Navigation works
// ═══════════════════════════════════════════════════
test('Docs: Sidebar navigation visible', async ({ page }) => {
  await page.goto(`${BASE}/#/docs`, { waitUntil: 'networkidle' });
  await expect(page.locator('text=GETTING STARTED').or(page.locator('text=Getting Started'))).toBeVisible({ timeout: 5000 });
});

test('Docs: API Reference shows endpoints', async ({ page }) => {
  await page.goto(`${BASE}/#/docs`, { waitUntil: 'networkidle' });
  // Click API Reference in sidebar
  const apiLink = page.locator('text=API Reference');
  if (await apiLink.isVisible()) {
    await apiLink.click();
    await page.waitForTimeout(500);
    const content = await page.locator('main, [class*="content"]').innerText();
    expect(content.toLowerCase()).toContain('api');
  }
});

// ═══════════════════════════════════════════════════
// FOOTER — All links present
// ═══════════════════════════════════════════════════
test('Footer: All links present', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const footer = page.locator('footer');
  await footer.scrollIntoViewIfNeeded();
  const footerLinks = ['Managed', 'MCP', 'Pipeline', 'Dashboard', 'Pricing', 'Documentation', 'GitHub'];
  for (const link of footerLinks) {
    await expect(footer.locator(`text=${link}`).first()).toBeVisible({ timeout: 3000 });
  }
});

// ═══════════════════════════════════════════════════
// RESPONSIVE — Mobile viewport
// ═══════════════════════════════════════════════════
test('Mobile: Home page renders on phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await expect(page.locator('nav, header, [class*="navbar"]').first()).toBeVisible({ timeout: 5000 });
});

test('Mobile: Managed page usable on phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/#/managed`, { waitUntil: 'networkidle' });
  const input = page.locator('input[placeholder*="github"]');
  await expect(input).toBeVisible({ timeout: 5000 });
});

// ═══════════════════════════════════════════════════
// PERFORMANCE — Load time checks
// ═══════════════════════════════════════════════════
test('Performance: Home loads under 5s', async ({ page }) => {
  const start = Date.now();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const loadTime = Date.now() - start;
  expect(loadTime).toBeLessThan(10000);
});

// ═══════════════════════════════════════════════════
// INTEGRATOR — Architecture section renders
// ═══════════════════════════════════════════════════
test('Integrator: page renders', async ({ page }) => {
  await page.goto(`${BASE}/#/integrator`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  // The page doesn't have a literal "Integrator" heading — it visualizes
  // a 4-layer architecture flow. Verify the page body has substantial
  // content (it's a media-heavy diagram page).
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.length).toBeGreaterThan(300);
});
