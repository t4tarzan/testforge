// E2E lane (Phase 1) — autonomous smoke crawl. Reuses the app /simulate already
// booted: a sibling Playwright container on the same docker network crawls the
// app and reports console errors, uncaught page errors, failing HTTP responses,
// and axe-core a11y violations. No LLM — low-flake and demoable. Phase 2
// (LLM-authored user journeys) builds on the same boot + image.
import { spawn } from 'child_process';
import type { Sandbox } from './sandbox.js';

// Crawler image. Defaults to the public GHCR image; the hub/VPS override to the
// locally-built `testforge-e2e:local` (the GHCR image must be pushed+public —
// same lifecycle as the loadgen/runner images).
export const E2E_IMAGE = process.env.TESTFORGE_E2E_IMAGE || 'ghcr.io/t4tarzan/testforge-e2e:latest';
const E2E_TIMEOUT_MS = Number(process.env.TESTFORGE_E2E_TIMEOUT_MS) || 180_000;

export interface E2EPageResult {
  url: string;
  status: number;
  error?: string;
  consoleErrors: string[];
  pageErrors: string[];
  httpErrors: { url: string; status: number }[];
  a11yViolations?: number;
  a11yByImpact?: Record<string, number>;
}

export interface E2EResult {
  ranReal: boolean;
  method: 'playwright-crawl';
  reason?: string;
  pagesCrawled?: number;
  consoleErrors?: number;
  pageErrors?: number;
  httpErrors?: number;
  a11yViolations?: number;
  pagesWithErrors?: number;
  pages?: E2EPageResult[];
}

function docker(args: string[], timeoutMs: number): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const killer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch { /* ignore */ } }, timeoutMs);
    proc.on('error', (e: Error) => { clearTimeout(killer); resolve({ code: -1, stdout: '', stderr: e.message }); });
    proc.stdout.on('data', (b) => { out += b.toString(); });
    proc.stderr.on('data', (b) => { err += b.toString(); });
    proc.on('close', (code) => { clearTimeout(killer); resolve({ code: code ?? -1, stdout: out, stderr: err }); });
  });
}

export interface RunE2EOptions {
  maxPages?: number;
  onProgress?: (detail: string) => void;
}

/**
 * Crawl the booted app from a sibling Playwright container on its network.
 * Returns ranReal=false (with a reason) when the crawler image is unavailable
 * or its output can't be parsed.
 */
export async function runE2ECrawl(sb: Sandbox, opts: RunE2EOptions = {}): Promise<E2EResult> {
  const maxPages = Math.min(opts.maxPages ?? 8, 25);
  const target = `http://${sb.appHost}:${sb.targetPort}/`;
  opts.onProgress?.(`Crawling ${target} (≤${maxPages} pages)`);

  // Chromium needs more than the default 64MB /dev/shm; --no-sandbox is set in
  // the script so dropped caps are fine. Network is the per-sim network only.
  const r = await docker([
    'run', '--rm', '--network', sb.netName,
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '--memory', '2g', '--shm-size', '512m',
    E2E_IMAGE, 'node', '/e2e/crawl.mjs', target, String(maxPages),
  ], E2E_TIMEOUT_MS);

  if (r.code !== 0 && !r.stdout.trim()) {
    return { ranReal: false, method: 'playwright-crawl', reason: `crawler failed: ${(r.stderr.trim() || `exit ${r.code}`).slice(-240)}` };
  }
  try {
    const line = r.stdout.trim().split('\n').filter(Boolean).pop() || '';
    const j = JSON.parse(line) as { ok: boolean; totals: Record<string, number>; pages: E2EPageResult[] };
    if (!j.ok) return { ranReal: false, method: 'playwright-crawl', reason: 'crawler reported failure' };
    return { ranReal: true, method: 'playwright-crawl', ...j.totals, pages: j.pages };
  } catch {
    return { ranReal: false, method: 'playwright-crawl', reason: 'could not parse crawler output', pages: [] };
  }
}
