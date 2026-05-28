#!/usr/bin/env node
// TestForge Findings — daily digest send job.
//
// Runs on the hub (where the current 0.28.x analyzer lives; the Fly.io MCP is
// stale). Picks a rotating "random bag" of public repos, analyzes each via the
// local MCP /clone-and-analyze, composes an email, fetches the active
// subscriber list from the protected Vercel endpoint, and sends via Resend
// with a signed one-click unsubscribe link.
//
// Secrets are read from ~/testforge/keys.md (persistent local store):
//   RESEND_API_KEY, DIGEST_SECRET, UNSUB_SECRET
//
// Usage:
//   node scripts/send-digest.mjs --dry              # analyze + compose, write HTML, NO send
//   node scripts/send-digest.mjs --test you@x.com   # send only to that address
//   node scripts/send-digest.mjs                    # full send to all subscribers (cron)
//   flags: --count N (repos, default 3) --limit N (max recipients)

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const SITE = 'https://testforge.run';
const MCP = 'http://localhost:33221';
const KEYS = path.join(os.homedir(), 'testforge', 'keys.md');
const UA = 'testforge-digest/1.0 (+vinayak@whitenoiseacademy.com)';
const FROM = 'TestForge Findings <findings@testforge.run>';
const REPLY_TO = 'vinayak@whitenoiseacademy.com';

// ── flags ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const val = (name, d) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : d;
};
const DRY = flag('--dry');
const TEST_EMAIL = val('--test', null);
const REPO_COUNT = parseInt(val('--count', '3'), 10);
const RECIPIENT_LIMIT = parseInt(val('--limit', '50000'), 10);

// ── curated pool: small/medium public repos that clone+analyze fast,
//    spanning JS/TS · Python · Go so the digest shows polyglot reach ───────
const POOL = [
  { url: 'https://github.com/lukeed/clsx', branch: 'master', lang: 'TypeScript' },
  { url: 'https://github.com/sindresorhus/slugify', branch: 'main', lang: 'JavaScript' },
  { url: 'https://github.com/colinhacks/zod', branch: 'main', lang: 'TypeScript' },
  { url: 'https://github.com/pmndrs/zustand', branch: 'main', lang: 'TypeScript' },
  { url: 'https://github.com/tj/commander.js', branch: 'master', lang: 'JavaScript' },
  { url: 'https://github.com/honojs/hono', branch: 'main', lang: 'TypeScript' },
  { url: 'https://github.com/developit/mitt', branch: 'main', lang: 'TypeScript' },
  { url: 'https://github.com/lukeed/uvu', branch: 'master', lang: 'JavaScript' },
  { url: 'https://github.com/pallets/click', branch: 'main', lang: 'Python' },
  { url: 'https://github.com/tiangolo/typer', branch: 'master', lang: 'Python' },
  { url: 'https://github.com/encode/httpx', branch: 'master', lang: 'Python' },
  { url: 'https://github.com/python-attrs/attrs', branch: 'main', lang: 'Python' },
  { url: 'https://github.com/spf13/cobra', branch: 'main', lang: 'Go' },
  { url: 'https://github.com/gorilla/mux', branch: 'main', lang: 'Go' },
  { url: 'https://github.com/julienschmidt/httprouter', branch: 'master', lang: 'Go' },
  { url: 'https://github.com/urfave/cli', branch: 'main', lang: 'Go' },
  { url: 'https://github.com/charmbracelet/lipgloss', branch: 'master', lang: 'Go' },
  { url: 'https://github.com/sindresorhus/ky', branch: 'main', lang: 'TypeScript' },
];

function readSecret(name) {
  let txt = '';
  try { txt = fs.readFileSync(KEYS, 'utf8'); } catch { /* */ }
  const m = txt.match(new RegExp('^' + name + '=(.+)$', 'm'));
  return m ? m[1].trim() : process.env[name] || '';
}

function dayOfYear(d = new Date()) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000);
}

// Deterministic-by-date rotation through the pool with language variety.
function pickRepos(n) {
  const offset = (dayOfYear() * n) % POOL.length;
  const picked = [];
  const seenLang = new Set();
  for (let i = 0; i < POOL.length && picked.length < n; i++) {
    const r = POOL[(offset + i) % POOL.length];
    if (seenLang.has(r.lang) && POOL.length - i > n - picked.length) continue;
    picked.push(r);
    seenLang.add(r.lang);
  }
  while (picked.length < n) picked.push(POOL[(offset + picked.length) % POOL.length]);
  return picked.slice(0, n);
}

async function ensureMcp() {
  try {
    const h = await fetch(`${MCP}/health`, { signal: AbortSignal.timeout(3000) });
    if (h.ok) return;
  } catch { /* not running */ }
  console.log('[digest] starting local MCP…');
  // process.execPath (not "node") so this works under launchd, where PATH is
  // not the login shell's.
  const child = spawn(process.execPath, ['mcp-server/dist/index.js'], {
    cwd: REPO_ROOT,
    env: { ...process.env, PORT: '33221' },
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const h = await fetch(`${MCP}/health`, { signal: AbortSignal.timeout(2000) });
      if (h.ok) return;
    } catch { /* keep waiting */ }
  }
  throw new Error('local MCP did not come up on :33221');
}

function clamp(v) { return Math.max(0, Math.min(100, Math.round(v || 0))); }

// Compact overall score: average of the dimensions that apply, mirroring the
// showcase distiller.
function overallOf(r) {
  const sec = r.security || {};
  const secScore = clamp(100 - (sec.critical || 0) * 20 - (sec.high || 0) * 5);
  const dims = [secScore, clamp(r.unit?.coverage), clamp(r.stack?.score), clamp(r.scope?.coverage)];
  if (r.accessibility?.applicable !== false) dims.push(clamp(r.accessibility?.score));
  return Math.round(dims.reduce((a, b) => a + b, 0) / dims.length);
}

async function analyzeRepo({ url, branch, lang }) {
  const res = await fetch(`${MCP}/clone-and-analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl: url, branch }),
    signal: AbortSignal.timeout(110000),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  const sec = data.security || {};
  // Only feature CONFIRMED critical/high findings in a public digest — medium/
  // low items are review-grade and surfacing them would be the cry-wolf noise
  // we work to avoid. The headline counts still report the full totals.
  const strong = (sec.items || [])
    .filter((i) => i.severity === 'critical' || i.severity === 'high')
    .sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1));
  const top = strong[0];
  const cleanPath = (p) => String(p || '').replace(/^.*?\/testforge-repos\/[^/]+\//, '');
  return {
    name: url.replace('https://github.com/', ''),
    url,
    lang,
    overall: overallOf(data),
    files: data.codebase?.totalFiles || 0,
    sec: { findings: sec.findings || 0, critical: sec.critical || 0, high: sec.high || 0 },
    a11y: data.accessibility?.applicable === false ? null : clamp(data.accessibility?.score),
    topFinding: top ? { sev: top.severity, title: top.title, path: cleanPath(top.filePath), line: top.lineNumber } : null,
  };
}

function unsubToken(email) {
  return crypto.createHmac('sha256', readSecret('UNSUB_SECRET')).update(email).digest('hex');
}

function esc(s) { return String(s || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }

const sevColor = { critical: '#D4524A', high: '#F97316', medium: '#EAB308', low: '#574a7d' };

function repoCard(r) {
  const scoreColor = r.overall >= 80 ? '#0d9488' : r.overall >= 50 ? '#574a7d' : '#D4524A';
  const finding = r.topFinding
    ? `<div style="margin-top:10px;font-size:13px;color:#4A4A4A"><span style="display:inline-block;font:600 10px/1.6 monospace;text-transform:uppercase;letter-spacing:.06em;color:${sevColor[r.topFinding.sev] || '#574a7d'};background:${(sevColor[r.topFinding.sev] || '#574a7d')}14;padding:1px 7px;border-radius:10px">${esc(r.topFinding.sev)}</span> ${esc(r.topFinding.title)}${r.topFinding.path ? `<br><code style="font-size:11px;color:#9A9A9A">${esc(r.topFinding.path)}${r.topFinding.line ? ':' + r.topFinding.line : ''}</code>` : ''}</div>`
    : `<div style="margin-top:10px;font-size:13px;color:#0d9488">No critical or high-severity findings.</div>`;
  return `
  <tr><td style="padding:0 0 14px">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #D9D9D3;border-radius:12px;overflow:hidden">
      <tr>
        <td style="padding:18px 20px;border-left:3px solid ${scoreColor}">
          <table width="100%"><tr>
            <td>
              <div style="font:600 10px/1.6 monospace;text-transform:uppercase;letter-spacing:.1em;color:#9A9A9A">${esc(r.lang)} · ${r.files.toLocaleString()} files</div>
              <a href="${esc(r.url)}" style="font:600 17px/1.3 -apple-system,Segoe UI,sans-serif;color:#12101A;text-decoration:none">${esc(r.name)}</a>
            </td>
            <td align="right" style="white-space:nowrap">
              <div style="font:700 28px/1 -apple-system,sans-serif;color:${scoreColor}">${r.overall}</div>
              <div style="font:10px/1.4 monospace;color:#9A9A9A;text-transform:uppercase">overall</div>
            </td>
          </tr></table>
          <div style="margin-top:10px;font:12px/1.6 monospace;color:#6B6B6B">
            ${r.sec.findings} security finding${r.sec.findings === 1 ? '' : 's'}${r.sec.critical ? ` · ${r.sec.critical} critical` : ''}${r.sec.high ? ` · ${r.sec.high} high` : ''}${r.a11y !== null ? ` · a11y ${r.a11y}` : ' · a11y N/A'}
          </div>
          ${finding}
        </td>
      </tr>
    </table>
  </td></tr>`;
}

function buildEmail(repos, email) {
  const token = unsubToken(email);
  const unsubUrl = `${SITE}/api/unsubscribe?e=${encodeURIComponent(email)}&t=${token}`;
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const cards = repos.map(repoCard).join('');
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#F7F7FB;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
  <table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto">
    <tr><td style="padding:0 0 20px">
      <div style="font:600 11px/1.6 monospace;text-transform:uppercase;letter-spacing:.12em;color:#574a7d">// TESTFORGE FINDINGS · ${esc(dateStr)}</div>
      <h1 style="margin:8px 0 6px;font:700 24px/1.2 -apple-system,sans-serif;color:#12101A">Today’s random bag</h1>
      <p style="margin:0;font:15px/1.6 -apple-system,sans-serif;color:#6B6B6B">${repos.length} public repos, run through TestForge on your behalf. Real findings — and when a flag turns out to be a false positive, it becomes the next analyzer release.</p>
    </td></tr>
    ${cards}
    <tr><td style="padding:6px 0 0">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#12101A;border-radius:12px"><tr><td style="padding:22px;text-align:center">
        <div style="font:600 16px/1.4 -apple-system,sans-serif;color:#fff;margin-bottom:6px">Run it on your own repo</div>
        <div style="display:inline-block;background:rgba(255,255,255,.08);border-radius:8px;padding:9px 14px;font:13px/1 monospace;color:#a99bff">npx -y @whitenoisenpm/testforge-mcp@latest</div>
        <div style="margin-top:12px"><a href="${SITE}/in-the-wild" style="color:#a99bff;font:14px -apple-system,sans-serif">See the full reports →</a></div>
      </td></tr></table>
    </td></tr>
    <tr><td style="padding:20px 0;text-align:center;font:12px/1.6 -apple-system,sans-serif;color:#9A9A9A">
      You’re getting this because you subscribed at testforge.run.<br>
      <a href="${unsubUrl}" style="color:#9A9A9A;text-decoration:underline">Unsubscribe</a> · <a href="${SITE}/changelog" style="color:#9A9A9A">Changelog</a>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `TESTFORGE FINDINGS — ${dateStr}`,
    `${repos.length} public repos run through TestForge.`,
    '',
    ...repos.map((r) => {
      const f = r.topFinding ? `  top: [${r.topFinding.sev}] ${r.topFinding.title}${r.topFinding.path ? ` (${r.topFinding.path}${r.topFinding.line ? ':' + r.topFinding.line : ''})` : ''}` : '  no critical/high findings';
      return `${r.name} [${r.lang}] — overall ${r.overall}/100\n  ${r.sec.findings} security finding(s), a11y ${r.a11y ?? 'N/A'}\n${f}\n  ${r.url}`;
    }),
    '',
    'Run it yourself: npx -y @whitenoisenpm/testforge-mcp@latest',
    `Full reports: ${SITE}/in-the-wild`,
    '',
    `Unsubscribe: ${unsubUrl}`,
  ].join('\n');

  return {
    from: FROM,
    to: [email],
    reply_to: REPLY_TO,
    subject: `TestForge Findings — ${repos.map((r) => r.name.split('/').pop()).join(', ')}`,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubUrl}>, <mailto:${REPLY_TO}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

async function getRecipients() {
  if (TEST_EMAIL) return [TEST_EMAIL];
  const res = await fetch(`${SITE}/api/digest-recipients`, {
    headers: { Authorization: `Bearer ${readSecret('DIGEST_SECRET')}`, 'User-Agent': UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`recipients endpoint HTTP ${res.status}`);
  const data = await res.json();
  return (data.emails || []).slice(0, RECIPIENT_LIMIT);
}

async function sendBatch(messages) {
  const key = readSecret('RESEND_API_KEY');
  if (!key) throw new Error('no RESEND_API_KEY in keys.md');
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify(messages),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${body.slice(0, 200)}`);
  return JSON.parse(body);
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function main() {
  const stamp = new Date().toISOString();
  console.log(`[digest] ${stamp} — start (dry=${DRY} test=${TEST_EMAIL || '-'} count=${REPO_COUNT})`);

  await ensureMcp();
  const picks = pickRepos(REPO_COUNT);
  console.log('[digest] repos:', picks.map((p) => p.url.replace('https://github.com/', '')).join(', '));

  const results = [];
  for (const p of picks) {
    try {
      const r = await analyzeRepo(p);
      results.push(r);
      console.log(`[digest]   ✓ ${r.name} — overall ${r.overall}, ${r.sec.findings} sec, a11y ${r.a11y ?? 'N/A'}`);
    } catch (e) {
      console.log(`[digest]   ✗ ${p.url} — ${e.message}`);
    }
  }
  if (results.length === 0) {
    console.error('[digest] no successful analyses — aborting (no send)');
    process.exit(1);
  }

  if (DRY) {
    const sample = buildEmail(results, 'preview@testforge.run');
    const out = path.join(os.tmpdir(), 'digest-preview.html');
    fs.writeFileSync(out, sample.html);
    console.log(`[digest] DRY RUN — wrote ${out}`);
    console.log('\n' + sample.text + '\n');
    return;
  }

  const recipients = await getRecipients();
  console.log(`[digest] recipients: ${recipients.length}`);
  if (recipients.length === 0) {
    console.log('[digest] no recipients — nothing to send');
    return;
  }

  let sent = 0;
  for (const group of chunk(recipients, 100)) {
    const messages = group.map((email) => buildEmail(results, email));
    const resp = await sendBatch(messages);
    sent += (resp.data?.length ?? group.length);
    console.log(`[digest]   sent batch of ${group.length}`);
  }
  console.log(`[digest] ${new Date().toISOString()} — done. sent=${sent}`);
}

main().catch((e) => { console.error('[digest] FATAL:', e.message); process.exit(1); });
