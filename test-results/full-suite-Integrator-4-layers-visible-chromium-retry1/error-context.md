# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-suite.spec.ts >> Integrator: 4 layers visible
- Location: e2e/full-suite.spec.ts:191:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('h1, h2').filter({ hasText: 'Integrator' }).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('h1, h2').filter({ hasText: 'Integrator' }).first()

```

```yaml
- navigation:
  - link "TestForge":
    - /url: "#/"
    - img
    - text: TestForge
  - link "Managed":
    - /url: "#/managed"
  - link "Pipeline":
    - /url: "#/pipeline"
  - link "Integrator":
    - /url: "#/integrator"
  - link "Testing":
    - /url: "#/testing-dimensions"
  - link "Dashboard":
    - /url: "#/dashboard"
  - link "Pricing":
    - /url: "#/pricing"
  - link "Sign In":
    - /url: "#/auth"
  - link "Get Started":
    - /url: "#/auth?tab=signup"
- main:
  - paragraph: // THE INTEGRATOR
  - heading "The brain between testing and shipping." [level=1]
  - paragraph: No existing tool combines test failures, merge conflicts, dependency graphs, and build state into unified integration recommendations. The Integrator does.
  - text: Merge Conflict Detection Dependency Analysis Stack Compatibility Intelligent Path Selection
  - button "See How It Works"
  - paragraph: // THE PROBLEM
  - heading "Integration is where code goes to die." [level=2]
  - heading "Merge Conflicts" [level=3]
  - paragraph: You fix a test, but the fix conflicts with another developer's branch. Hours lost in rebase hell.
  - paragraph: 0%of teams
  - heading "Dependency Conflicts" [level=3]
  - paragraph: Updating one package breaks three others. The test passes locally but fails in CI due to version mismatches.
  - paragraph: 0 hoursavg
  - heading "No Unified View" [level=3]
  - paragraph: Test tools, build systems, and dependency managers don't talk to each other. You're flying blind when integrating.
  - paragraph: 0+tools needed
  - paragraph: // ARCHITECTURE
  - heading "Four layers. One intelligent decision engine." [level=2]
  - text: "01"
  - heading "State Ingestion" [level=3]
  - paragraph: Collects test results, build states, dependency graphs, PR metadata, and git history from all connected systems.
  - text: Git Status Test Results Build State Dependencies 02
  - heading "Analysis Engine" [level=3]
  - paragraph: Cross-references all data points to identify conflicts, incompatibilities, and risks using learned organizational patterns.
  - text: Conflict Detection Risk Scoring Pattern Matching Impact Analysis 03
  - heading "Action Engine" [level=3]
  - paragraph: Generates ranked integration paths with success probabilities and test-validated action plans.
  - text: Path Ranking Success Probability Migration Plans Auto-PR 04
  - heading "Validation Layer" [level=3]
  - paragraph: Verifies each recommended action. Runs dry-run integrations and confirms no new conflicts.
  - text: Dry-Run Tests Conflict Verification Rollback Plan Sign-off Data flows left to right through all four layers
  - paragraph: // DECISION FLOW
  - heading "From chaos to clarity in four steps." [level=2]
  - text: "01"
  - heading "Ingest" [level=4]
  - paragraph: All test results, build states, and dependencies are collected in real-time.
  - text: "02"
  - heading "Analyze" [level=4]
  - paragraph: Conflicts and risks are identified using ML pattern matching across your organization's history.
  - text: "03"
  - heading "Recommend" [level=4]
  - paragraph: Ranked paths with probability scores — choose the safest route forward.
  - text: "04"
  - heading "Validate" [level=4]
  - paragraph: Dry-run the integration, confirm zero new conflicts, ship with confidence.
  - img
  - heading "Recommended Integration Path" [level=3]
  - text: "1 Current 2 Step 1 3 Step 2 4 Merged 87% success probability Estimated time: 23 min"
  - button "Accept & Execute"
  - button "View Alternatives"
  - button "Reject"
  - paragraph: // KEY CAPABILITIES
  - heading "Intelligence that learns your stack." [level=2]
  - heading "Stack Compatibility Analysis" [level=3]
  - paragraph: Maps your entire technology stack — frameworks, libraries, tools — and checks compatibility across versions before integration.
  - heading "Dependency Conflict Detection" [level=3]
  - paragraph: Identifies version conflicts, deprecated dependencies, and circular references before they break your build.
  - heading "Merge Conflict Prediction" [level=3]
  - paragraph: Predicts merge conflicts before they happen by analyzing branch divergence, overlapping changes, and file contention.
  - heading "Intelligent Path Recommendation" [level=3]
  - paragraph: Generates multiple integration paths ranked by success probability, time estimate, and risk level. You choose.
  - heading "Autonomous Multi-Step Paths" [level=3]
  - paragraph: Complex integrations are broken into atomic steps. Each step is validated before the next executes automatically.
  - heading "Integration Knowledge Graph" [level=3]
  - paragraph: A living map of your organization's integration patterns. Learns from every decision to improve future recommendations.
  - heading "No other tool does this." [level=2]
  - paragraph: The Integrator is the only system that unifies test results, build state, dependency graphs, and merge analysis into a single recommendation engine.
  - table:
    - rowgroup:
      - row "Capability TestForge Traditional CI/CD TestSprite":
        - columnheader "Capability"
        - columnheader "TestForge"
        - columnheader "Traditional CI/CD"
        - columnheader "TestSprite"
    - rowgroup:
      - row "Test Result Analysis":
        - cell "Test Result Analysis"
        - cell
        - cell
        - cell
      - row "Merge Conflict Detection":
        - cell "Merge Conflict Detection"
        - cell
        - cell
        - cell
      - row "Dependency Conflict Detection":
        - cell "Dependency Conflict Detection"
        - cell
        - cell
        - cell
      - row "Build State Integration":
        - cell "Build State Integration"
        - cell
        - cell
        - cell
      - row "Intelligent Path Ranking":
        - cell "Intelligent Path Ranking"
        - cell
        - cell
        - cell
      - row "Knowledge Graph Learning":
        - cell "Knowledge Graph Learning"
        - cell
        - cell
        - cell
      - row "Autonomous Execution":
        - cell "Autonomous Execution"
        - cell
        - cell
        - cell
  - img
  - heading "Stop guessing. Start integrating with intelligence." [level=2]
  - button "Get Started Free"
  - button "Explore Testing Dimensions"
- contentinfo:
  - img
  - text: TestForge
  - paragraph: Privacy-first autonomous testing. Harden your codebase, ship with certainty.
  - link:
    - /url: https://github.com/t4tarzan/testforge
  - link:
    - /url: "#"
  - link:
    - /url: "#"
  - link:
    - /url: "#"
  - heading "Product" [level=4]
  - list:
    - listitem:
      - link "Managed":
        - /url: "#/managed"
    - listitem:
      - link "MCP Integration":
        - /url: "#/mcp"
    - listitem:
      - link "Pipeline":
        - /url: "#/pipeline"
    - listitem:
      - link "The Integrator":
        - /url: "#/integrator"
    - listitem:
      - link "Dashboard":
        - /url: "#/dashboard"
    - listitem:
      - link "Pricing":
        - /url: "#/pricing"
  - heading "Resources" [level=4]
  - list:
    - listitem:
      - link "Documentation":
        - /url: "#/docs"
    - listitem:
      - link "API Reference":
        - /url: "#/docs"
    - listitem:
      - link "Test Runner":
        - /url: "#/run-test"
    - listitem:
      - link "PRD Generator":
        - /url: "#/prd-generator"
    - listitem:
      - link "Testing Dimensions":
        - /url: "#/testing-dimensions"
  - heading "Company" [level=4]
  - list:
    - listitem:
      - link "GitHub":
        - /url: https://github.com/t4tarzan/testforge
    - listitem:
      - link "Fly.io MCP":
        - /url: https://testforge-mcp.fly.dev
    - listitem:
      - link "Contact":
        - /url: https://github.com/t4tarzan/testforge/issues
    - listitem:
      - link "Changelog":
        - /url: /docs
    - listitem:
      - link "Status":
        - /url: https://testforge-mcp.fly.dev/health
  - paragraph: 2026 TestForge. All rights reserved.
  - text: All Systems Operational
```

# Test source

```ts
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
  184 |   const loadTime = Date.now() - start;
  185 |   expect(loadTime).toBeLessThan(10000);
  186 | });
  187 | 
  188 | // ═══════════════════════════════════════════════════
  189 | // INTEGRATOR — Architecture section renders
  190 | // ═══════════════════════════════════════════════════
  191 | test('Integrator: 4 layers visible', async ({ page }) => {
  192 |   await page.goto(`${BASE}/#/integrator`, { waitUntil: 'networkidle' });
  193 |   const layers = page.locator('text=State Ingestion, text=Analysis Engine, text=Action Engine, text=Validation Layer');
  194 |   // At least the page loads
> 195 |   await expect(page.locator('h1, h2').filter({ hasText: 'Integrator' }).first()).toBeVisible({ timeout: 5000 });
      |                                                                                  ^ Error: expect(locator).toBeVisible() failed
  196 | });
  197 | 
```