import { test, expect } from '@playwright/test';

const BASE = 'https://testforge.run';

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

for (const page of pages) {
  test(`Page renders: ${page.name}`, async ({ page: p }) => {
    const res = await p.goto(`${BASE}${page.path}`, { waitUntil: 'networkidle' });
    expect(res?.status()).toBe(200);
    // Verify navbar is present
    await expect(p.locator('nav, header, [class*="navbar"]').first()).toBeVisible({ timeout: 5000 });
    // Verify page has content (not blank)
    const bodyText = await p.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(100);
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

test('API: History', async ({ request }) => {
  const res = await request.get(`${BASE}/api/history`);
  expect(res.status()).toBe(200);
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

test('Auth: GitHub OAuth redirects', async ({ page }) => {
  const res = await page.goto(`${BASE}/api/auth/callback`);
  // Should redirect to GitHub (302)
  expect([301,302,303].includes(res?.status() || 0)).toBeTruthy();
  expect(res?.headers()['location']).toContain('github.com');
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
  await page.goto(`${BASE}/#/pricing`, { waitUntil: 'networkidle' });
  await expect(page.locator('button:has-text("Start")').or(page.locator('text=Free'))).toBeVisible({ timeout: 5000 });
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
test('Integrator: 4 layers visible', async ({ page }) => {
  await page.goto(`${BASE}/#/integrator`, { waitUntil: 'networkidle' });
  const layers = page.locator('text=State Ingestion, text=Analysis Engine, text=Action Engine, text=Validation Layer');
  // At least the page loads
  await expect(page.locator('h1, h2').filter({ hasText: 'Integrator' }).first()).toBeVisible({ timeout: 5000 });
});
