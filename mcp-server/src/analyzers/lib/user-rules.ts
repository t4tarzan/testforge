// User-authored rules DSL — Phase 4c.
//
// Projects can drop a `.testforge/rules.yaml` (or `.json`) at their
// root to declare custom pattern detectors that ride on top of the
// built-in analyzer. The DSL is intentionally small in v1 — most
// real-world asks are "flag any call to ${our internal helper} that
// gets tainted input" — but everything fans through the AST and
// taint engine we already built, so adding match shapes later is a
// few lines each.
//
// Example:
//
//   # .testforge/rules.yaml
//   version: 1
//   rules:
//     - id: no-internal-unsafe-query
//       title: "Internal unsafe query helper"
//       description: "Project policy: app code must not call internalApi.unsafeQuery."
//       severity: critical
//       category: "SQL Injection"
//       match:
//         callee: internalApi.unsafeQuery
//       fixSuggestion: "Use internalApi.query() which parameterizes inputs."
//
//     - id: no-tainted-debug-log
//       severity: medium
//       category: "Sensitive Data Exposure"
//       title: "User input in debug logger"
//       match:
//         callee: debugLog
//         taintedArg: 0
//
//     - id: no-secret-keys-in-storage
//       severity: high
//       category: "Hardcoded Secrets"
//       title: "Token-shaped value in localStorage"
//       match:
//         callee: localStorage.setItem
//         argRegex:
//           index: 0
//           pattern: "token|secret|password|api[_-]?key"
//
// Failure mode: malformed rules are logged once to stderr and SKIPPED.
// One bad rule never aborts the analyzer, never poisons other rules.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import * as t from '@babel/types';
import { evaluateTaint, describeFlow, type TaintTable } from './taint.js';
import { getCalleeName } from './visitors.js';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface UserRuleMatch {
  /** Exact dotted callee match (e.g. "db.query", "localStorage.setItem"). String or array. */
  callee?: string | string[];
  /** Regex callee match (alternative to `callee`). Anchored as written. */
  calleeRegex?: string;
  /** If set, the argument at this index must evaluate as tainted (Phase 2 engine). */
  taintedArg?: number;
  /** If set, the string-literal arg at this index must match this regex. */
  argRegex?: {
    index: number;
    pattern: string;
    flags?: string;
  };
}

export interface UserRule {
  id: string;
  title: string;
  description?: string;
  severity: Severity;
  category: string;
  match: UserRuleMatch;
  fixSuggestion?: string;
}

/** Hot-path representation — regex pre-compiled, callees pre-normalized. */
interface CompiledRule extends UserRule {
  _calleeSet: Set<string> | null;
  _calleeRegex: RegExp | null;
  _argRegex: RegExp | null;
}

/* -------------------------------------------------------------------------- */
/* Loader                                                                      */
/* -------------------------------------------------------------------------- */

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
const MAX_RULES = 200;

/**
 * Load user rules from `<projectPath>/.testforge/rules.yaml` (or .json).
 * Returns [] if no file is present, the file is empty, or every rule
 * was invalid. One-shot warnings go to stderr; we never throw.
 */
export function loadUserRules(projectPath: string): UserRule[] {
  if (!projectPath) return [];

  const candidates = [
    join(projectPath, '.testforge', 'rules.yaml'),
    join(projectPath, '.testforge', 'rules.yml'),
    join(projectPath, '.testforge', 'rules.json'),
  ];
  const file = candidates.find((p) => existsSync(p));
  if (!file) return [];

  let raw: unknown;
  try {
    const content = readFileSync(file, 'utf-8');
    raw = file.endsWith('.json') ? JSON.parse(content) : yaml.load(content);
  } catch (e) {
    process.stderr.write(
      `[testforge] failed to parse ${file}: ${(e as Error).message}\n`
    );
    return [];
  }

  if (!raw || typeof raw !== 'object') return [];
  const rulesRaw = (raw as Record<string, unknown>).rules;
  if (!Array.isArray(rulesRaw)) {
    process.stderr.write(
      `[testforge] ${file}: expected top-level 'rules' array\n`
    );
    return [];
  }

  const valid: UserRule[] = [];
  for (const r of rulesRaw.slice(0, MAX_RULES)) {
    const rule = validateRule(r, file);
    if (rule) valid.push(rule);
  }
  return valid;
}

function validateRule(raw: unknown, file: string): UserRule | null {
  if (!raw || typeof raw !== 'object') return warn(file, raw, 'must be an object');
  const r = raw as Record<string, unknown>;

  if (typeof r.id !== 'string' || !r.id) return warn(file, raw, 'missing id');
  if (typeof r.title !== 'string' || !r.title) return warn(file, r.id, 'missing title');
  if (typeof r.severity !== 'string' || !SEVERITIES.includes(r.severity as Severity)) {
    return warn(file, r.id, `severity must be one of ${SEVERITIES.join(', ')}`);
  }
  if (typeof r.category !== 'string' || !r.category) return warn(file, r.id, 'missing category');
  if (!r.match || typeof r.match !== 'object') return warn(file, r.id, 'missing match');

  const m = r.match as Record<string, unknown>;
  const hasCallee = typeof m.callee === 'string' || Array.isArray(m.callee);
  const hasCalleeRegex = typeof m.calleeRegex === 'string';
  if (!hasCallee && !hasCalleeRegex) {
    return warn(file, r.id, 'match needs a `callee` or `calleeRegex`');
  }

  if (m.taintedArg !== undefined && typeof m.taintedArg !== 'number') {
    return warn(file, r.id, 'taintedArg must be a number');
  }
  if (m.argRegex !== undefined) {
    const a = m.argRegex as Record<string, unknown>;
    if (typeof a.index !== 'number' || typeof a.pattern !== 'string') {
      return warn(file, r.id, 'argRegex must have numeric index and string pattern');
    }
  }

  return {
    id: r.id,
    title: r.title,
    description: typeof r.description === 'string' ? r.description : undefined,
    severity: r.severity as Severity,
    category: r.category,
    match: {
      callee: m.callee as string | string[] | undefined,
      calleeRegex: m.calleeRegex as string | undefined,
      taintedArg: m.taintedArg as number | undefined,
      argRegex: m.argRegex as UserRuleMatch['argRegex'],
    },
    fixSuggestion: typeof r.fixSuggestion === 'string' ? r.fixSuggestion : undefined,
  };
}

function warn(file: string, idOrRaw: unknown, msg: string): null {
  const tag = typeof idOrRaw === 'string' && idOrRaw ? idOrRaw : 'rule';
  process.stderr.write(`[testforge] ${file}: ${tag} — ${msg} (skipped)\n`);
  return null;
}

/* -------------------------------------------------------------------------- */
/* Compile                                                                     */
/* -------------------------------------------------------------------------- */

/** Pre-compile regex / set lookups so the hot path stays cheap. */
export function compileUserRules(rules: UserRule[]): CompiledRule[] {
  const out: CompiledRule[] = [];
  for (const r of rules) {
    let calleeSet: Set<string> | null = null;
    if (typeof r.match.callee === 'string') {
      calleeSet = new Set([r.match.callee]);
    } else if (Array.isArray(r.match.callee)) {
      calleeSet = new Set(r.match.callee);
    }

    let calleeRegex: RegExp | null = null;
    if (r.match.calleeRegex) {
      try {
        calleeRegex = new RegExp(r.match.calleeRegex);
      } catch (e) {
        process.stderr.write(
          `[testforge] rule ${r.id}: invalid calleeRegex (${(e as Error).message}) — skipped\n`
        );
        continue;
      }
    }

    let argRegex: RegExp | null = null;
    if (r.match.argRegex) {
      try {
        argRegex = new RegExp(r.match.argRegex.pattern, r.match.argRegex.flags ?? '');
      } catch (e) {
        process.stderr.write(
          `[testforge] rule ${r.id}: invalid argRegex (${(e as Error).message}) — skipped\n`
        );
        continue;
      }
    }

    out.push({ ...r, _calleeSet: calleeSet, _calleeRegex: calleeRegex, _argRegex: argRegex });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Match                                                                       */
/* -------------------------------------------------------------------------- */

export interface UserRuleHit {
  rule: UserRule;
  /** Reconstructed flow story when the rule fires via taintedArg. */
  flow?: string;
}

/**
 * Test every compiled rule against a single CallExpression. Returns all
 * rules that fired (most of the time it's zero or one).
 */
export function matchUserRules(
  call: t.CallExpression,
  table: TaintTable,
  rules: CompiledRule[]
): UserRuleHit[] {
  if (rules.length === 0) return [];
  const name = getCalleeName(call.callee);

  const hits: UserRuleHit[] = [];
  for (const rule of rules) {
    if (rule._calleeSet && !rule._calleeSet.has(name)) continue;
    if (rule._calleeRegex && !rule._calleeRegex.test(name)) continue;

    // taintedArg: arg at this index must come back tainted.
    let flow: string | undefined;
    if (rule.match.taintedArg !== undefined) {
      const arg = call.arguments[rule.match.taintedArg] as t.Node | undefined;
      if (!arg) continue;
      const taint = evaluateTaint(arg, table);
      if (!taint) continue;
      flow = describeFlow(taint);
    }

    // argRegex: string-literal arg must match.
    if (rule._argRegex && rule.match.argRegex) {
      const arg = call.arguments[rule.match.argRegex.index] as t.Node | undefined;
      if (!arg || !t.isStringLiteral(arg)) continue;
      if (!rule._argRegex.test(arg.value)) continue;
    }

    hits.push({ rule, flow });
  }
  return hits;
}
