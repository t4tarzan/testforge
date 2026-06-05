// E2E Phase 2 — execute an LLM-authored user journey expressed as a constrained
// step DSL (NOT raw LLM code: deterministic, safe, no eval). Each step is run
// with Playwright against the booted app; the run stops at the first failed
// step. Prints ONE JSON object {ok, results[]} to stdout.
//
// Invoked as: node /e2e/journey.mjs <baseUrl> <base64(JSON steps[])>
// Supported actions:
//   {action:'goto', path}                 navigate to base+path (default '/')
//   {action:'click', text|selector}       click by visible text or CSS selector
//   {action:'fill', selector, value}      fill an input
//   {action:'expectText', text}           assert page contains text
//   {action:'expectUrl', contains}        assert current URL contains substring
import { chromium } from 'playwright';

const base = process.argv[2];
let steps = [];
try { steps = JSON.parse(Buffer.from(process.argv[3] || '', 'base64').toString('utf8')); } catch { /* leave empty */ }
if (!base || !Array.isArray(steps) || steps.length === 0) {
  process.stdout.write(JSON.stringify({ ok: false, error: 'missing base url or steps' }) + '\n');
  process.exit(1);
}

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const results = [];
let ok = true;
try {
  const page = await browser.newPage();
  for (const s of steps) {
    const r = { action: s.action, target: s.text || s.selector || s.path || s.contains || s.value };
    try {
      if (s.action === 'goto') await page.goto(new URL(s.path || '/', base).href, { waitUntil: 'domcontentloaded', timeout: 15000 });
      else if (s.action === 'click') {
        if (s.text) await page.getByText(s.text, { exact: false }).first().click({ timeout: 8000 });
        else await page.click(s.selector, { timeout: 8000 });
      } else if (s.action === 'fill') await page.fill(s.selector, String(s.value ?? ''), { timeout: 8000 });
      else if (s.action === 'expectText') { if (!(await page.content()).includes(s.text)) throw new Error(`text not found: ${s.text}`); }
      else if (s.action === 'expectUrl') { if (!page.url().includes(s.contains)) throw new Error(`url "${page.url()}" lacks "${s.contains}"`); }
      else throw new Error(`unknown action: ${s.action}`);
      r.ok = true;
      results.push(r);
    } catch (e) {
      r.ok = false; r.error = String(e).split('\n')[0].slice(0, 200);
      results.push(r); ok = false; break;
    }
  }
} catch (e) {
  ok = false; results.push({ action: 'launch', ok: false, error: String(e).slice(0, 200) });
} finally {
  await browser.close();
}
process.stdout.write(JSON.stringify({ ok, results }) + '\n');
