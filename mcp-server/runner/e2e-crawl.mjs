// TestForge E2E smoke crawl — Phase 1 of the browser lane. Driven against the
// app /simulate already booted, from a sibling Playwright container on the same
// docker network. Autonomous (no LLM): BFS-crawl same-origin pages from the
// base URL and, per page, record console errors, uncaught page errors, failing
// HTTP responses (>=400), and axe-core accessibility violations. Prints ONE JSON
// object to stdout for the MCP to parse.
//
// Invoked as: node /e2e/crawl.mjs <baseUrl> [maxPages]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const base = process.argv[2];
const maxPages = Math.min(Number(process.argv[3]) || 8, 25);
if (!base) { process.stdout.write(JSON.stringify({ ok: false, error: 'no base url' }) + '\n'); process.exit(1); }

// axe-core is injected into each page and run in the browser context.
const axeSrc = readFileSync('/e2e/node_modules/axe-core/axe.min.js', 'utf8');

const origin = new URL(base).origin;
const seen = new Set();
const queue = [base];
const pages = [];

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await browser.newContext();

while (queue.length && pages.length < maxPages) {
  const url = (queue.shift() || '').split('#')[0];
  if (!url || seen.has(url)) continue;
  seen.add(url);

  const page = await ctx.newPage();
  const consoleErrors = [], pageErrors = [], httpErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
  page.on('response', (r) => { if (r.status() >= 400) httpErrors.push({ url: r.url().slice(0, 200), status: r.status() }); });

  let status = 0;
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    status = resp ? resp.status() : 0;

    let a11yViolations = 0; const a11yByImpact = {};
    try {
      await page.addScriptTag({ content: axeSrc });
      const a11y = await page.evaluate(async () => await window.axe.run(document, { resultTypes: ['violations'] }));
      a11yViolations = a11y.violations.length;
      for (const v of a11y.violations) {
        const k = v.impact || 'minor';
        a11yByImpact[k] = (a11yByImpact[k] || 0) + (v.nodes?.length || 1);
      }
    } catch { /* a11y best-effort */ }

    const links = await page.$$eval('a[href]', (as) => as.map((a) => a.href));
    for (const l of links) {
      try { if (new URL(l).origin === origin) { const clean = l.split('#')[0]; if (!seen.has(clean)) queue.push(clean); } } catch { /* skip bad href */ }
    }
    pages.push({ url, status, consoleErrors, pageErrors, httpErrors, a11yViolations, a11yByImpact });
  } catch (e) {
    pages.push({ url, status, error: String(e).slice(0, 200), consoleErrors, pageErrors, httpErrors });
  } finally {
    await page.close();
  }
}
await browser.close();

const sum = (f) => pages.reduce((n, p) => n + f(p), 0);
const totals = {
  pagesCrawled: pages.length,
  consoleErrors: sum((p) => p.consoleErrors?.length || 0),
  pageErrors: sum((p) => p.pageErrors?.length || 0),
  httpErrors: sum((p) => p.httpErrors?.length || 0),
  a11yViolations: sum((p) => p.a11yViolations || 0),
  pagesWithErrors: pages.filter((p) => p.error || (p.consoleErrors?.length || p.pageErrors?.length || p.httpErrors?.length)).length,
};
process.stdout.write(JSON.stringify({ ok: true, base, totals, pages }) + '\n');
