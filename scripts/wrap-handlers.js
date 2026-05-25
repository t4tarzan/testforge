#!/usr/bin/env node
// One-shot codemod: wrap every api/*.js handler with withSecurity().
// Removes manual CORS setHeader lines and the OPTIONS preflight block;
// converts `export default async function handler` → standalone function +
// `export default withSecurity(handler, opts)`.
//
// Skip rules baked in:
//   - api/_security.js, api/_middleware.js     → not handlers
//   - api/auth/callback.js                     → top-level OAuth redirect
//   - api/badge.js, api/status.js              → publicCors: true
//   - api/health.js, api/stripe-webhook.js     → skipRateLimit: true
//
// Idempotent: detects if a file already imports withSecurity and skips.

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const apiDir = path.join(root, 'api');

const SKIP_FILES = new Set([
  path.join(apiDir, '_security.js'),
  path.join(apiDir, '_middleware.js'),
  path.join(apiDir, 'auth', 'callback.js'),
]);

const OPTS = {
  'badge.js': '{ publicCors: true }',
  'status.js': '{ publicCors: true }',
  'health.js': '{ skipRateLimit: true }',
  'stripe-webhook.js': '{ skipRateLimit: true }',
};

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && full.endsWith('.js')) out.push(full);
  }
  return out;
}

function relativeImportPath(fromFile) {
  const fromDir = path.dirname(fromFile);
  const securityFile = path.join(apiDir, '_security.js');
  let rel = path.relative(fromDir, securityFile);
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function processFile(file) {
  let src = fs.readFileSync(file, 'utf8');
  const original = src;

  if (src.includes('withSecurity')) {
    return { file, changed: false, reason: 'already wrapped' };
  }

  // Strip the three CORS headers and the OPTIONS block.
  src = src.replace(/^\s*res\.setHeader\(\s*['"]Access-Control-Allow-Origin['"][^)]*\);\s*\n/gm, '');
  src = src.replace(/^\s*res\.setHeader\(\s*['"]Access-Control-Allow-Methods['"][^)]*\);\s*\n/gm, '');
  src = src.replace(/^\s*res\.setHeader\(\s*['"]Access-Control-Allow-Headers['"][^)]*\);\s*\n/gm, '');
  src = src.replace(
    /^\s*if\s*\(\s*req\.method\s*===\s*['"]OPTIONS['"]\s*\)\s*(?:return\s+res\.status\(204\)\.end\(\);|\{\s*return\s+res\.status\(204\)\.end\(\);\s*\})\s*\n/gm,
    ''
  );

  // Convert default export to a named handler + wrapper.
  // Match either `export default async function handler(req, res) {` or
  // `export default function handler(req, res) {`.
  const handlerRe = /export\s+default\s+(async\s+)?function\s+handler\s*\(/;
  if (!handlerRe.test(src)) {
    return { file, changed: false, reason: 'no recognizable default handler export' };
  }
  src = src.replace(handlerRe, '$1function handler(');

  // Drop any old broken imports of _security (e.g. ../_security from health.js).
  src = src.replace(/^\s*import\s+\{[^}]*\}\s+from\s+['"][^'"]*_security[^'"]*['"];\s*\n/gm, '');

  // Add new import at the top (after any "// comment" or shebang lines but before code).
  const importPath = relativeImportPath(file);
  const importLine = `import { withSecurity } from '${importPath}';\n`;
  // Insert after the last top-of-file import, or at very top.
  const lastImportMatch = [...src.matchAll(/^import\s+[^;]+;\s*\n/gm)].pop();
  if (lastImportMatch) {
    const insertAt = lastImportMatch.index + lastImportMatch[0].length;
    src = src.slice(0, insertAt) + importLine + src.slice(insertAt);
  } else {
    src = importLine + src;
  }

  // Append the wrapped export at the end.
  const base = path.basename(file);
  const opts = OPTS[base];
  const exportLine = opts
    ? `\nexport default withSecurity(handler, ${opts});\n`
    : `\nexport default withSecurity(handler);\n`;
  src = src.trimEnd() + '\n' + exportLine;

  if (src === original) {
    return { file, changed: false, reason: 'no-op' };
  }
  fs.writeFileSync(file, src);
  return { file, changed: true };
}

const files = walk(apiDir).filter((f) => !SKIP_FILES.has(f));
const results = files.map(processFile);

for (const r of results) {
  const rel = path.relative(root, r.file);
  if (r.changed) console.log(`✓ ${rel}`);
  else console.log(`- ${rel}  (${r.reason})`);
}
