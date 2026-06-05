// E2E Phase 2 — capture a compact "interaction surface" of the booted app's
// landing page so the model can author user journeys against real elements
// (not hallucinated ones). Prints ONE JSON object to stdout.
// Invoked as: node /e2e/snapshot.mjs <baseUrl>
import { chromium } from 'playwright';

const base = process.argv[2];
if (!base) { process.stdout.write(JSON.stringify({ error: 'no base url' }) + '\n'); process.exit(1); }

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const surface = await page.evaluate(() => ({
    title: document.title,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((h) => (h.textContent || '').trim()).filter(Boolean).slice(0, 12),
    links: [...document.querySelectorAll('a[href]')].map((a) => ({ text: (a.textContent || '').trim().slice(0, 50), href: a.getAttribute('href') })).slice(0, 30),
    buttons: [...document.querySelectorAll('button,[role=button],input[type=submit]')].map((b) => (b.textContent || b.value || '').trim().slice(0, 50)).filter(Boolean).slice(0, 20),
    forms: [...document.querySelectorAll('form')].map((f) => ({
      action: f.getAttribute('action') || '',
      inputs: [...f.querySelectorAll('input,select,textarea')].map((i) => ({
        name: i.getAttribute('name') || '', type: i.getAttribute('type') || i.tagName.toLowerCase(), placeholder: i.getAttribute('placeholder') || '',
      })).slice(0, 12),
    })).slice(0, 5),
  }));
  process.stdout.write(JSON.stringify({ ok: true, surface }) + '\n');
} catch (e) {
  process.stdout.write(JSON.stringify({ ok: false, error: String(e).slice(0, 200) }) + '\n');
} finally {
  await browser.close();
}
