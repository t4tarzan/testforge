# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-suite.spec.ts >> Page renders: Test Runner
- Location: e2e/full-suite.spec.ts:24:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('nav, header, [class*="navbar"]').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('nav, header, [class*="navbar"]').first()

```

```yaml
- img
- link "TestForge":
  - /url: "#/"
  - img
  - text: TestForge
- heading "Ship code with total confidence." [level=2]
- paragraph: Join 2,500+ teams who test smarter, not harder.
- text: 100K+ Tests Run 99.2% Accuracy < 2min Avg Setup
- paragraph: “TestForge caught a critical SQL injection in our checkout flow that somehow made it through 3 code reviews. Absolutely essential tool.”
- text: MC
- paragraph: Marcus Chen
- paragraph: CTO, CommerceStack
- paragraph: © 2026 TestForge. All rights reserved.
- button "Sign In"
- button "Sign Up"
- text: Email Address
- textbox "you@company.com"
- text: Password
- textbox "••••••••"
- button
- text: Remember me
- button "Forgot password?"
- button "Sign In"
- text: or continue with
- button "Continue with GitHub":
  - img
  - text: Continue with GitHub
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const BASE = 'https://testforge-steel.vercel.app';
  4   | 
  5   | // ═══════════════════════════════════════════════════
  6   | // PAGE RENDERING — Every page loads
  7   | // ═══════════════════════════════════════════════════
  8   | const pages = [
  9   |   { name: 'Home', path: '/' },
  10  |   { name: 'Managed', path: '/#/managed' },
  11  |   { name: 'Pipeline', path: '/#/pipeline' },
  12  |   { name: 'Integrator', path: '/#/integrator' },
  13  |   { name: 'Testing Dimensions', path: '/#/testing-dimensions' },
  14  |   { name: 'PRD Generator', path: '/#/prd-generator' },
  15  |   { name: 'Dashboard', path: '/#/dashboard' },
  16  |   { name: 'Pricing', path: '/#/pricing' },
  17  |   { name: 'Auth', path: '/#/auth' },
  18  |   { name: 'MCP Integration', path: '/#/mcp' },
  19  |   { name: 'Docs', path: '/#/docs' },
  20  |   { name: 'Test Runner', path: '/#/run-test' },
  21  | ];
  22  | 
  23  | for (const page of pages) {
  24  |   test(`Page renders: ${page.name}`, async ({ page: p }) => {
  25  |     const res = await p.goto(`${BASE}${page.path}`, { waitUntil: 'networkidle' });
  26  |     expect(res?.status()).toBe(200);
  27  |     // Verify navbar is present
> 28  |     await expect(p.locator('nav, header, [class*="navbar"]').first()).toBeVisible({ timeout: 5000 });
      |                                                                       ^ Error: expect(locator).toBeVisible() failed
  29  |     // Verify page has content (not blank)
  30  |     const bodyText = await p.locator('body').innerText();
  31  |     expect(bodyText.length).toBeGreaterThan(100);
  32  |   });
  33  | }
  34  | 
  35  | // ═══════════════════════════════════════════════════
  36  | // API ENDPOINTS — All return data
  37  | // ═══════════════════════════════════════════════════
  38  | test('API: Health check', async ({ request }) => {
  39  |   const res = await request.get(`${BASE}/api/health`);
  40  |   expect(res.status()).toBe(200);
  41  |   const data = await res.json();
  42  |   expect(data.status).toBe('ok');
  43  | });
  44  | 
  45  | test('API: Stripe plans', async ({ request }) => {
  46  |   const res = await request.get(`${BASE}/api/stripe`);
  47  |   expect(res.status()).toBe(200);
  48  |   const data = await res.json();
  49  |   expect(data.plans.length).toBeGreaterThanOrEqual(3);
  50  | });
  51  | 
  52  | test('API: Badge SVG', async ({ request }) => {
  53  |   const res = await request.get(`${BASE}/api/badge?score=85`);
  54  |   expect(res.status()).toBe(200);
  55  |   const contentType = res.headers()['content-type'];
  56  |   expect(contentType).toContain('svg');
  57  | });
  58  | 
  59  | test('API: Status page', async ({ request }) => {
  60  |   const res = await request.get(`${BASE}/api/status`);
  61  |   expect(res.status()).toBe(200);
  62  | });
  63  | 
  64  | test('API: History', async ({ request }) => {
  65  |   const res = await request.get(`${BASE}/api/history`);
  66  |   expect(res.status()).toBe(200);
  67  | });
  68  | 
  69  | // ═══════════════════════════════════════════════════
  70  | // AUTH FLOW — Login page works
  71  | // ═══════════════════════════════════════════════════
  72  | test('Auth: Login page renders', async ({ page }) => {
  73  |   await page.goto(`${BASE}/#/auth`, { waitUntil: 'networkidle' });
  74  |   // Should have GitHub button
  75  |   await expect(page.locator('text=Continue with GitHub')).toBeVisible({ timeout: 5000 });
  76  |   // Should have email login form
  77  |   await expect(page.locator('input[type="email"], input[placeholder*="email"]').first()).toBeVisible();
  78  | });
  79  | 
  80  | test('Auth: GitHub OAuth redirects', async ({ page }) => {
  81  |   const res = await page.goto(`${BASE}/api/auth/callback`);
  82  |   // Should redirect to GitHub (302)
  83  |   expect([301,302,303].includes(res?.status() || 0)).toBeTruthy();
  84  |   expect(res?.headers()['location']).toContain('github.com');
  85  | });
  86  | 
  87  | // ═══════════════════════════════════════════════════
  88  | // MANAGED PAGE — Can submit a repo
  89  | // ═══════════════════════════════════════════════════
  90  | test('Managed: Input accepts repo URL', async ({ page }) => {
  91  |   await page.goto(`${BASE}/#/managed`, { waitUntil: 'networkidle' });
  92  |   const input = page.locator('input[placeholder*="github.com"]');
  93  |   await expect(input).toBeVisible({ timeout: 5000 });
  94  |   await input.fill('https://github.com/tinyhttp/malibu');
  95  |   expect(await input.inputValue()).toBe('https://github.com/tinyhttp/malibu');
  96  | });
  97  | 
  98  | test('Managed: Run Analysis button exists', async ({ page }) => {
  99  |   await page.goto(`${BASE}/#/managed`, { waitUntil: 'networkidle' });
  100 |   await expect(page.locator('button:has-text("Run Analysis")')).toBeVisible({ timeout: 5000 });
  101 | });
  102 | 
  103 | // ═══════════════════════════════════════════════════
  104 | // PRICING — Plans and CTAs
  105 | // ═══════════════════════════════════════════════════
  106 | test('Pricing: Three tiers visible', async ({ page }) => {
  107 |   await page.goto(`${BASE}/#/pricing`, { waitUntil: 'networkidle' });
  108 |   await expect(page.locator('button:has-text("Start")').or(page.locator('text=Free'))).toBeVisible({ timeout: 5000 });
  109 | });
  110 | 
  111 | test('Pricing: Free CTA links to managed', async ({ page }) => {
  112 |   await page.goto(`${BASE}/#/pricing`, { waitUntil: 'networkidle' });
  113 |   const freeBtn = page.locator('button:has-text("Start Testing Free")');
  114 |   if (await freeBtn.isVisible()) {
  115 |     await freeBtn.click();
  116 |     await page.waitForURL('**/managed**', { timeout: 5000 });
  117 |     expect(page.url()).toContain('managed');
  118 |   }
  119 | });
  120 | 
  121 | // ═══════════════════════════════════════════════════
  122 | // DASHBOARD — Shows data
  123 | // ═══════════════════════════════════════════════════
  124 | test('Dashboard: Loads with content', async ({ page }) => {
  125 |   await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'networkidle' });
  126 |   await expect(page.locator('text=ANALYTICS').or(page.locator('text=analytics'))).toBeVisible({ timeout: 5000 });
  127 | });
  128 | 
```