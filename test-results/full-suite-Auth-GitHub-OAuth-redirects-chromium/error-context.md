# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-suite.spec.ts >> Auth: GitHub OAuth redirects
- Location: e2e/full-suite.spec.ts:80:1

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - link "Skip to content" [ref=e4] [cursor=pointer]:
      - /url: "#start-of-content"
    - banner [ref=e6]
  - main [ref=e9]:
    - generic [ref=e10]:
      - generic [ref=e12]:
        - img "TestForge logo" [ref=e14]
        - paragraph [ref=e15]:
          - text: Sign in to
          - strong [ref=e16]: GitHub
          - text: to continue to
          - strong [ref=e17]: TestForge
      - generic [ref=e19]:
        - generic [ref=e20]:
          - generic [ref=e21]: Username or email address
          - textbox "Username or email address" [active] [ref=e22]
        - generic [ref=e23]:
          - generic [ref=e24]: Password
          - textbox "Password" [ref=e25]
          - link "Forgot password?" [ref=e26] [cursor=pointer]:
            - /url: /password_reset
        - button "Sign in" [ref=e28] [cursor=pointer]
      - paragraph [ref=e31]:
        - text: New to GitHub?
        - link "Create an account" [ref=e32] [cursor=pointer]:
          - /url: /join?return_to=%2Flogin%2Foauth%2Fauthorize%3Fclient_id%3DOv23li7vXUvPjCVDBdBM%26redirect_uri%3Dhttps%253A%252F%252Ftestforge-steel.vercel.app%252Fapi%252Fauth%252Fcallback%26scope%3Dread%253Auser%2Buser%253Aemail%26state%3D5fh9edp9x8p&source=oauth
  - contentinfo [ref=e33]:
    - list [ref=e34]:
      - listitem [ref=e35]:
        - link "Terms" [ref=e36] [cursor=pointer]:
          - /url: https://docs.github.com/site-policy/github-terms/github-terms-of-service
      - listitem [ref=e37]:
        - link "Privacy" [ref=e38] [cursor=pointer]:
          - /url: https://docs.github.com/site-policy/privacy-policies/github-privacy-statement
      - listitem [ref=e39]:
        - link "Docs" [ref=e40] [cursor=pointer]:
          - /url: https://docs.github.com
      - listitem [ref=e41]:
        - link "Contact GitHub Support" [ref=e42] [cursor=pointer]:
          - /url: https://support.github.com
      - listitem [ref=e43]:
        - button "Manage cookies" [ref=e45] [cursor=pointer]
      - listitem [ref=e46]:
        - button "Do not share my personal information" [ref=e48] [cursor=pointer]
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
  28  |     await expect(p.locator('nav, header, [class*="navbar"]').first()).toBeVisible({ timeout: 5000 });
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
> 83  |   expect([301,302,303].includes(res?.status() || 0)).toBeTruthy();
      |                                                      ^ Error: expect(received).toBeTruthy()
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
  129 | // ═══════════════════════════════════════════════════
  130 | // DOCS — Navigation works
  131 | // ═══════════════════════════════════════════════════
  132 | test('Docs: Sidebar navigation visible', async ({ page }) => {
  133 |   await page.goto(`${BASE}/#/docs`, { waitUntil: 'networkidle' });
  134 |   await expect(page.locator('text=GETTING STARTED').or(page.locator('text=Getting Started'))).toBeVisible({ timeout: 5000 });
  135 | });
  136 | 
  137 | test('Docs: API Reference shows endpoints', async ({ page }) => {
  138 |   await page.goto(`${BASE}/#/docs`, { waitUntil: 'networkidle' });
  139 |   // Click API Reference in sidebar
  140 |   const apiLink = page.locator('text=API Reference');
  141 |   if (await apiLink.isVisible()) {
  142 |     await apiLink.click();
  143 |     await page.waitForTimeout(500);
  144 |     const content = await page.locator('main, [class*="content"]').innerText();
  145 |     expect(content.toLowerCase()).toContain('api');
  146 |   }
  147 | });
  148 | 
  149 | // ═══════════════════════════════════════════════════
  150 | // FOOTER — All links present
  151 | // ═══════════════════════════════════════════════════
  152 | test('Footer: All links present', async ({ page }) => {
  153 |   await page.goto(BASE, { waitUntil: 'networkidle' });
  154 |   const footer = page.locator('footer');
  155 |   await footer.scrollIntoViewIfNeeded();
  156 |   const footerLinks = ['Managed', 'MCP', 'Pipeline', 'Dashboard', 'Pricing', 'Documentation', 'GitHub'];
  157 |   for (const link of footerLinks) {
  158 |     await expect(footer.locator(`text=${link}`).first()).toBeVisible({ timeout: 3000 });
  159 |   }
  160 | });
  161 | 
  162 | // ═══════════════════════════════════════════════════
  163 | // RESPONSIVE — Mobile viewport
  164 | // ═══════════════════════════════════════════════════
  165 | test('Mobile: Home page renders on phone', async ({ page }) => {
  166 |   await page.setViewportSize({ width: 375, height: 812 });
  167 |   await page.goto(BASE, { waitUntil: 'networkidle' });
  168 |   await expect(page.locator('nav, header, [class*="navbar"]').first()).toBeVisible({ timeout: 5000 });
  169 | });
  170 | 
  171 | test('Mobile: Managed page usable on phone', async ({ page }) => {
  172 |   await page.setViewportSize({ width: 375, height: 812 });
  173 |   await page.goto(`${BASE}/#/managed`, { waitUntil: 'networkidle' });
  174 |   const input = page.locator('input[placeholder*="github"]');
  175 |   await expect(input).toBeVisible({ timeout: 5000 });
  176 | });
  177 | 
  178 | // ═══════════════════════════════════════════════════
  179 | // PERFORMANCE — Load time checks
  180 | // ═══════════════════════════════════════════════════
  181 | test('Performance: Home loads under 5s', async ({ page }) => {
  182 |   const start = Date.now();
  183 |   await page.goto(BASE, { waitUntil: 'networkidle' });
```