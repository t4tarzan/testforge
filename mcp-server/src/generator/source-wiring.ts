// Approach A "leaf-module wiring": decide whether a finding's source file can be
// shipped into the Tier-2 sandbox and IMPORTED for real (so the generated test
// exercises the user's ACTUAL code, not a recreation of it).
//
// The sandbox runs `--network none` with no project deps installed (see
// docker-runner.ts), so we can only wire a file whose entire import surface is
// satisfiable in that sandbox: a "leaf" — no third-party imports and no relative
// imports (which would drag in more files we'd have to ship a closure of). Files
// with only Node built-ins (fs, crypto, path…) still qualify; the runner image
// has Node. v1 is JS/TS only; Python/Go fall back to the self-contained path.

/** Node built-in modules — importing these works in the sandbox (Node is present). */
const NODE_BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants',
  'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'http2', 'https', 'inspector',
  'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring', 'readline',
  'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events', 'tty', 'url',
  'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
]);

const JS_EXT = /\.(?:js|jsx|ts|tsx|mjs|cjs)$/i;
const MAX_WIRE_CHARS = 16_000; // keep payloads + sandbox parse bounded

function isAllowedSpecifier(spec: string): boolean {
  // node: prefix (node:fs, node:crypto/promises) or a bare builtin (fs, fs/promises).
  const bare = spec.replace(/^node:/, '').split('/')[0];
  if (spec.startsWith('node:')) return NODE_BUILTINS.has(bare);
  return NODE_BUILTINS.has(bare);
}

/** Every module specifier referenced by import/export/require/dynamic-import. */
function importSpecifiers(content: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /\bimport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g, // import x from '…'
    /\bimport\s*['"]([^'"]+)['"]/g,                  // import '…' (side-effect)
    /\bexport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,  // export … from '…'
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,        // require('…')
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,         // import('…')
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) specs.push(m[1]);
  }
  return specs;
}

/**
 * If `filePath`/`content` is a wireable JS/TS leaf, return its source (capped);
 * otherwise undefined. A leaf imports only Node built-ins (or nothing) — any
 * relative or third-party import disqualifies it (we'd need a dependency closure
 * / installed deps, which the sandbox doesn't have).
 */
export function wireableLeafSource(filePath: string, content: string): { content: string } | undefined {
  if (!filePath || !JS_EXT.test(filePath)) return undefined;
  if (!content || content.length > MAX_WIRE_CHARS) return undefined;
  for (const spec of importSpecifiers(content)) {
    if (spec.startsWith('.') || spec.startsWith('/')) return undefined; // relative → needs closure
    if (!isAllowedSpecifier(spec)) return undefined;                    // third-party → no deps in sandbox
  }
  return { content };
}
