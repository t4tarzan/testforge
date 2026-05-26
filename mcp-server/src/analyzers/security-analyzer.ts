// Security analyzer — AST-based static analysis for JS/TS/JSX/TSX projects.
//
// Replaces the previous regex-per-line approach. Each check is now an AST
// visitor that examines structured nodes (CallExpression, MemberExpression,
// JSXAttribute, etc.) rather than substrings, which means:
//
//   • Fewer false positives. `db.query('SELECT 1')` is a string literal call,
//     not a concat — we know from the node shape.
//   • Precise locations: line AND column.
//   • Honors inline suppressions (`// testforge-disable-next-line ...`).
//   • Per-finding confidence (`high` / `medium` / `low`).
//
// Project-level checks (rate-limit dep, vulnerable deps, missing helmet)
// stay as they were — they're config-shape, not code-shape.

import { readFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

import { parseFile, isParseable } from './lib/parse.js';
import {
  collectSuppressions,
  isSuppressed,
  type SuppressionTable,
} from './lib/suppressions.js';
import {
  containsReqAccess,
  getCalleeName,
  hasPropertyNamed,
  hasUnsafeInterpolation,
  isDbQueryCall,
  isReqAccess,
  isStringConcatWithVar,
  nodeLoc,
  snippetForLine,
} from './lib/visitors.js';

// @babel/traverse ships an interop default — in ESM it's `traverseModule.default`.
const traverse = (traverseModule as unknown as { default?: typeof traverseModule }).default
  ?? traverseModule;

/* -------------------------------------------------------------------------- */
/* Public types                                                                */
/* -------------------------------------------------------------------------- */

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Confidence = 'high' | 'medium' | 'low';

export interface SecurityFinding {
  id?: string;
  severity: Severity;
  /** New in 0.3.0 — per-finding confidence. Old consumers can ignore. */
  confidence?: Confidence;
  title: string;
  description: string;
  filePath: string;
  lineNumber: number;
  /** New in 0.3.0 — column number where the issue starts (0-based). */
  column?: number;
  codeSnippet: string;
  fixSuggestion: string;
  category: string;
}

interface SecurityConfig {
  projectPath: string;
  fileContents: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
}

/* -------------------------------------------------------------------------- */
/* Per-file timeout — wall-clock budget for parse + traverse                  */
/* -------------------------------------------------------------------------- */

const PER_FILE_MS = 250;

/* -------------------------------------------------------------------------- */
/* Entry                                                                      */
/* -------------------------------------------------------------------------- */

export async function runSecurityAnalysis(
  config: SecurityConfig
): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  const allDeps = [...config.dependencies, ...config.devDependencies];

  let fileContents = config.fileContents;
  if (!fileContents || Object.keys(fileContents).length === 0) {
    fileContents = await loadFileContents(config.projectPath);
  }

  for (const [filePath, content] of Object.entries(fileContents)) {
    if (!isParseable(filePath)) continue;
    const fileFindings = analyzeFile(filePath, content);
    findings.push(...fileFindings);
  }

  // ── Project-level checks (regex / dep-list, unchanged shape) ────────
  checkMissingRateLimit(allDeps, findings, config.projectPath);
  checkInsecureDependencies(allDeps, findings);
  checkMissingSecurityHeaders(fileContents, findings);

  return dedupeFindings(findings);
}

function dedupeFindings(findings: SecurityFinding[]): SecurityFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.category}|${f.filePath}|${f.lineNumber}|${f.column ?? 0}|${f.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function analyzeFile(filePath: string, content: string): SecurityFinding[] {
  const startedAt = Date.now();
  const parsed = parseFile(filePath, content);

  if (parsed.oversize) {
    return [
      {
        severity: 'info',
        confidence: 'high',
        title: 'File too large to analyze',
        description: `File exceeds the 500 KB analyzer cap. Likely generated / bundled output; security findings for this file are not produced.`,
        filePath,
        lineNumber: 1,
        codeSnippet: '',
        fixSuggestion: 'Exclude generated files from the analyzed tree (e.g. dist/, build/, .next/).',
        category: 'Coverage',
      },
    ];
  }

  if (!parsed.ast) {
    return [
      {
        severity: 'info',
        confidence: 'low',
        title: 'File could not be parsed',
        description: parsed.error
          ? `Babel parser rejected this file: ${parsed.error.slice(0, 200)}`
          : 'Babel parser rejected this file. Findings for it may be incomplete.',
        filePath,
        lineNumber: 1,
        codeSnippet: '',
        fixSuggestion: 'Verify the file compiles cleanly. If it does, the analyzer plugin list may need extending.',
        category: 'Coverage',
      },
    ];
  }

  const suppressions = collectSuppressions(parsed.ast);
  const isTestFile = /\.(?:test|spec)\.[mc]?[jt]sx?$/.test(filePath) || filePath.endsWith('.d.ts');
  const raw: SecurityFinding[] = [];

  // First pass — collect local variables that are tainted by string-concat
  // with request-borne input. Used by the SQL-injection check to flag
  // `const q = 'select ...' + req.x; db.query(q);` even though the
  // `db.query` argument is just an identifier.
  const taintedLocals = collectTaintedLocals(parsed.ast);

  try {
    traverse(parsed.ast, {
      enter(path) {
        if (Date.now() - startedAt > PER_FILE_MS) {
          path.stop(); // bail out gracefully — file gets partial coverage
          return;
        }
      },
      CallExpression(path) {
        checkSqlInjection(path.node, filePath, content, raw, taintedLocals);
        checkDangerousFunctions(path.node, filePath, content, raw);
        checkPathTraversal(path.node, filePath, content, raw);
        checkUnvalidatedRedirect(path.node, filePath, content, raw);
        checkResSinks(path.node, filePath, content, raw);
        checkAuthBypassRoute(path.node, filePath, content, raw, isTestFile);
        checkCorsCall(path.node, filePath, content, raw);
        checkSensitiveResponseJson(path.node, filePath, content, raw);
      },
      AssignmentExpression(path) {
        checkInnerHtmlAssignment(path.node, filePath, content, raw);
      },
      JSXAttribute(path) {
        checkDangerouslySetInnerHTML(path.node, filePath, content, raw);
      },
      VariableDeclarator(path) {
        checkHardcodedSecret(path.node, filePath, content, raw);
        checkSensitiveReturn(path.node, filePath, content, raw);
      },
      ReturnStatement(path) {
        checkSensitiveReturn(path.node, filePath, content, raw);
      },
      StringLiteral(path) {
        checkSecretStringLiteral(path.node, filePath, content, raw);
      },
    });
  } catch (e) {
    // traverse blew up — keep what we collected so far, emit an info note
    raw.push({
      severity: 'info',
      confidence: 'low',
      title: 'Analyzer traversal aborted',
      description: e instanceof Error ? e.message.slice(0, 200) : String(e),
      filePath,
      lineNumber: 1,
      codeSnippet: '',
      fixSuggestion: 'Report the file shape to the TestForge team.',
      category: 'Coverage',
    });
  }

  // Apply suppressions
  return raw.filter((f) => !isSuppressed(suppressions, f.lineNumber, f.category));
}

/* -------------------------------------------------------------------------- */
/* Check helpers                                                              */
/* -------------------------------------------------------------------------- */

function push(
  raw: SecurityFinding[],
  filePath: string,
  content: string,
  node: t.Node,
  partial: Omit<SecurityFinding, 'filePath' | 'lineNumber' | 'codeSnippet' | 'column'>
) {
  const loc = nodeLoc(node);
  raw.push({
    ...partial,
    filePath,
    lineNumber: loc.line,
    column: loc.column,
    codeSnippet: snippetForLine(content, loc.line),
  });
}

/* -------------------------------------------------------------------------- */
/* 1. SQL / NoSQL injection                                                   */
/* -------------------------------------------------------------------------- */

function checkSqlInjection(
  call: t.CallExpression,
  filePath: string,
  content: string,
  out: SecurityFinding[],
  taintedLocals: Set<string>
) {
  const name = getCalleeName(call.callee);
  if (!isDbQueryCall(name)) return;

  const firstArg = call.arguments[0];
  if (!firstArg) return;

  // Three dangerous shapes:
  //   1. db.query(`SELECT ... ${x}`)             — template-literal w/ interp
  //   2. db.query('SELECT ' + x)                  — string concat w/ variable
  //   3. const q = '...' + req.x; db.query(q);   — tainted local passed in
  const inlineUnsafe =
    hasUnsafeInterpolation(firstArg as t.Node) ||
    isStringConcatWithVar(firstArg as t.Node);

  let taintedVia: 'inline' | 'local' | null = null;
  let fromReq = false;

  if (inlineUnsafe) {
    taintedVia = 'inline';
    fromReq = containsReqAccess(firstArg as t.Node);
  } else if (t.isIdentifier(firstArg) && taintedLocals.has(firstArg.name)) {
    // Local-flow case: the variable was initialized from a concat that
    // touched req.* somewhere up the file. We mark fromReq=true because
    // the taint-collection step only ever sets that condition.
    taintedVia = 'local';
    fromReq = true;
  }

  if (!taintedVia) return;

  push(out, filePath, content, call, {
    severity: 'critical',
    confidence: fromReq ? 'high' : 'medium',
    title: 'Potential SQL/NoSQL Injection',
    description:
      taintedVia === 'inline'
        ? `${name}() is called with a string built from variables. ` +
          (fromReq
            ? 'A descendant of the argument reads from req.* — tainted-input → query sink.'
            : 'Variables interpolated into a query string become injection vectors when fed user input.')
        : `${name}() is called with a local variable that was initialized from a request-tainted string concatenation. ` +
          'The query reaches a database call without parameter binding.',
    fixSuggestion:
      'Use parameterized queries (placeholders like $1, $2) or an ORM. ' +
      'Never concatenate or interpolate variables into a query string — let the driver bind them.',
    category: 'SQL Injection',
  });
}

/**
 * One-pass collection of local variables that were initialized from a
 * request-tainted concatenation/template — e.g. `const q = '...' + req.x`.
 * Identifier-by-name, with no scope precision: false positives are bounded
 * because the SQL sink will only fire when the SAME name appears as a
 * db.query arg. False negatives are bounded because shadowing the name in
 * a nested scope still flags (which is desirable for SAST).
 */
function collectTaintedLocals(ast: t.File): Set<string> {
  const tainted = new Set<string>();
  traverse(ast, {
    VariableDeclarator(path) {
      const id = path.node.id;
      const init = path.node.init;
      if (!t.isIdentifier(id) || !init) return;
      const isConcatWithReq =
        (isStringConcatWithVar(init) || hasUnsafeInterpolation(init)) &&
        containsReqAccess(init);
      const isDirectReq = isReqAccess(init) || containsReqAccess(init);
      if (isConcatWithReq || isDirectReq) {
        tainted.add(id.name);
      }
    },
    AssignmentExpression(path) {
      const n = path.node;
      if (n.operator !== '=' || !t.isIdentifier(n.left)) return;
      const isConcatWithReq =
        (isStringConcatWithVar(n.right) || hasUnsafeInterpolation(n.right)) &&
        containsReqAccess(n.right);
      const isDirectReq = isReqAccess(n.right) || containsReqAccess(n.right);
      if (isConcatWithReq || isDirectReq) {
        tainted.add(n.left.name);
      }
    },
  });
  return tainted;
}

/* -------------------------------------------------------------------------- */
/* 5b. res.json({password: ...}) — sensitive field in response payload         */
/* -------------------------------------------------------------------------- */

function checkSensitiveResponseJson(
  call: t.CallExpression,
  filePath: string,
  content: string,
  out: SecurityFinding[]
) {
  const callee = call.callee;
  if (!t.isMemberExpression(callee) || callee.computed) return;
  const propName = t.isIdentifier(callee.property) ? callee.property.name : '';
  if (propName !== 'json') return;
  const obj = callee.object;
  if (!t.isIdentifier(obj) || !['res', 'response', 'reply', 'ctx'].includes(obj.name)) return;

  const arg = call.arguments[0];
  if (!arg || !t.isObjectExpression(arg)) return;
  const sensitiveFields = ['password', 'passwordhash', 'pwd', 'secret', 'token', 'access_token', 'refresh_token'];
  const matched = findPropertyName(arg, sensitiveFields);
  if (!matched) return;

  push(out, filePath, content, call, {
    severity: 'high',
    confidence: 'high',
    title: `${matched} field in response body`,
    description: `${obj.name}.json() is shipping an object with a \`${matched}\` property — sensitive data exposure.`,
    fixSuggestion: 'Strip sensitive fields before responding. Use a projection (Drizzle column list / Prisma select) at the DB layer so the field never enters the response object.',
    category: 'Sensitive Data Exposure',
  });
}

/** Returns the first matching property name on an ObjectExpression, or null. */
function findPropertyName(obj: t.ObjectExpression, names: string[]): string | null {
  for (const p of obj.properties) {
    if (!t.isObjectProperty(p)) continue;
    const k = p.key;
    const keyName = t.isIdentifier(k) ? k.name : t.isStringLiteral(k) ? k.value : null;
    if (keyName && names.includes(keyName.toLowerCase())) return keyName;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* 2. eval / new Function / exec / setTimeout("...")                          */
/* -------------------------------------------------------------------------- */

function checkDangerousFunctions(
  call: t.CallExpression,
  filePath: string,
  content: string,
  out: SecurityFinding[]
) {
  const name = getCalleeName(call.callee);
  const firstArg = call.arguments[0] as t.Node | undefined;

  // eval(...)
  if (name === 'eval') {
    const fromReq = !!firstArg && containsReqAccess(firstArg);
    push(out, filePath, content, call, {
      severity: 'critical',
      confidence: fromReq ? 'high' : 'medium',
      title: 'eval() Usage',
      description: fromReq
        ? 'eval() called with an expression that reads req.* — direct RCE vulnerability.'
        : 'eval() executes arbitrary code. Avoid in production code.',
      fixSuggestion:
        'Replace eval with JSON.parse for JSON, with a real parser for DSLs, or with explicit dispatch tables for known commands.',
      category: 'Dangerous Functions',
    });
    return;
  }

  // new Function("...")
  if (
    t.isNewExpression(call as unknown as t.Node) &&
    t.isIdentifier((call as unknown as t.NewExpression).callee, { name: 'Function' })
  ) {
    push(out, filePath, content, call, {
      severity: 'critical',
      confidence: 'medium',
      title: 'Function() Constructor',
      description: 'new Function() creates a function from a string — equivalent to eval().',
      fixSuggestion: 'Use a real function declaration or a safe dispatch table.',
      category: 'Dangerous Functions',
    });
    return;
  }

  // child_process.exec / execSync
  if (/(?:^|\.)(exec|execSync)$/.test(name) && /child_process/.test(name)) {
    const fromReq = !!firstArg && containsReqAccess(firstArg);
    push(out, filePath, content, call, {
      severity: 'critical',
      confidence: fromReq ? 'high' : 'medium',
      title: 'Shell Command Execution',
      description: fromReq
        ? 'exec() called with a string containing user input — command injection.'
        : 'child_process.exec runs a shell. Prefer execFile/spawn with an array of args.',
      fixSuggestion:
        'Switch to execFile() or spawn() with the command and args as separate arguments. Never pass user input through a shell.',
      category: 'Dangerous Functions',
    });
    return;
  }

  // setTimeout/setInterval with a string body
  if ((name === 'setTimeout' || name === 'setInterval') && firstArg && t.isStringLiteral(firstArg)) {
    push(out, filePath, content, call, {
      severity: 'high',
      confidence: 'high',
      title: `${name}(string) is eval-equivalent`,
      description: `${name} with a string argument evaluates that string in the global scope.`,
      fixSuggestion: `Pass a function instead: ${name}(() => { ... }, ms).`,
      category: 'Dangerous Functions',
    });
  }
}

/* -------------------------------------------------------------------------- */
/* 3. Path traversal                                                          */
/* -------------------------------------------------------------------------- */

const FS_READ_NAMES = ['readFile', 'readFileSync', 'createReadStream', 'sendFile', 'open', 'openSync'];

function checkPathTraversal(
  call: t.CallExpression,
  filePath: string,
  content: string,
  out: SecurityFinding[]
) {
  const name = getCalleeName(call.callee);
  const isFsRead = FS_READ_NAMES.some((n) => name === n || name.endsWith(`.${n}`));
  const isPathBuild = name === 'path.join' || name === 'path.resolve';
  if (!isFsRead && !isPathBuild) return;

  const argHasReq = call.arguments.some((a) => containsReqAccess(a as t.Node));
  const argHasConcat = call.arguments.some((a) => isStringConcatWithVar(a as t.Node) || hasUnsafeInterpolation(a as t.Node));
  if (!argHasReq && !argHasConcat) return;

  push(out, filePath, content, call, {
    severity: 'high',
    confidence: argHasReq ? 'high' : 'low',
    title: 'Path Traversal Risk',
    description: argHasReq
      ? `${name}() received a path built from req.* — open path traversal.`
      : `${name}() received a path built by string concatenation. Verify the input is sanitized.`,
    fixSuggestion:
      'Normalize and validate the path against an allowlist (e.g. resolve, then ensure the result starts with the expected base directory). ' +
      'Prefer file ids → server-resolved paths over user-supplied paths.',
    category: 'Path Traversal',
  });
}

/* -------------------------------------------------------------------------- */
/* 4. Unvalidated / open redirect                                             */
/* -------------------------------------------------------------------------- */

function checkUnvalidatedRedirect(
  call: t.CallExpression,
  filePath: string,
  content: string,
  out: SecurityFinding[]
) {
  const name = getCalleeName(call.callee);
  if (!/(?:^|\.)redirect$/.test(name)) return;
  const arg = call.arguments[call.arguments.length - 1] as t.Node | undefined;
  if (!arg || !containsReqAccess(arg)) return;

  push(out, filePath, content, call, {
    severity: 'medium',
    confidence: 'high',
    title: 'Unvalidated Redirect',
    description: `${name}() called with a URL derived from req.* — attacker-controlled redirect (phishing vector).`,
    fixSuggestion:
      'Validate the redirect target against an explicit allowlist of paths or domains. Prefer redirecting to internal route names.',
    category: 'Open Redirect',
  });
}

/* -------------------------------------------------------------------------- */
/* 5. res.send / res.json / res.write with req.* (reflected XSS)              */
/* -------------------------------------------------------------------------- */

function checkResSinks(
  call: t.CallExpression,
  filePath: string,
  content: string,
  out: SecurityFinding[]
) {
  const callee = call.callee;
  if (!t.isMemberExpression(callee) || callee.computed) return;
  const propName = t.isIdentifier(callee.property) ? callee.property.name : '';
  if (!['send', 'write', 'render'].includes(propName)) return;

  const obj = callee.object;
  if (!t.isIdentifier(obj) || !['res', 'response', 'reply', 'ctx'].includes(obj.name)) return;

  const arg = call.arguments[0] as t.Node | undefined;
  if (!arg || !containsReqAccess(arg)) return;

  // res.json reflecting req data is generally safer (proper content-type),
  // but res.send / res.write / res.render render as HTML in many setups.
  push(out, filePath, content, call, {
    severity: 'high',
    confidence: 'medium',
    title: 'Unsanitized User Input in Response',
    description:
      `${obj.name}.${propName}() echoes a request value back to the client. If the value contains HTML, this is reflected XSS.`,
    fixSuggestion:
      'Escape with a templating engine, or use res.json() for data responses with a strict Content-Type. ' +
      'For HTML, use a sanitizer (DOMPurify, sanitize-html).',
    category: 'XSS',
  });
}

/* -------------------------------------------------------------------------- */
/* 6. Auth bypass (heuristic — only when test/d.ts excluded)                  */
/* -------------------------------------------------------------------------- */

const ROUTE_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch']);

function checkAuthBypassRoute(
  call: t.CallExpression,
  filePath: string,
  content: string,
  out: SecurityFinding[],
  isTestFile: boolean
) {
  if (isTestFile) return;

  // Match `router.get('/x', handler)` or `app.post('/x', mw, handler)`.
  const callee = call.callee;
  if (!t.isMemberExpression(callee) || callee.computed) return;
  const propName = t.isIdentifier(callee.property) ? callee.property.name : '';
  if (!ROUTE_METHODS.has(propName)) return;
  const obj = callee.object;
  if (!t.isIdentifier(obj) || !['router', 'app', 'fastify'].includes(obj.name)) return;

  // Heuristic: a route with only the path + a single handler (no middleware)
  // is the canonical "no auth attached" shape. If the user wraps every route
  // in a global middleware, this fires false-positive — confidence: low.
  // We DON'T fire when the handler is a function expression literal that
  // itself contains `req.user` or `passport` references — that suggests
  // auth is being handled inline.
  const handler = call.arguments[call.arguments.length - 1] as t.Node | undefined;
  if (!handler) return;
  if (call.arguments.length > 2) return; // probably has middleware already
  if (containsTokenLike(handler)) return;

  push(out, filePath, content, call, {
    severity: 'high',
    confidence: 'low',
    title: 'Route Without Inline Auth',
    description: `${obj.name}.${propName}() declares a route with no visible auth middleware. If your app uses a global auth middleware, mark this finding suppressed.`,
    fixSuggestion:
      'Either declare a route-scoped auth middleware (e.g. `app.get(path, requireAuth, handler)`) or document a global middleware in the entry file. ' +
      'Add `// testforge-disable-next-line authentication-bypass` to suppress if your global middleware is intentional.',
    category: 'Authentication Bypass',
  });
}

function containsTokenLike(node: t.Node): boolean {
  let found = false;
  // Use the lightweight walker imported from visitors? We need it for
  // arbitrary node shapes. Inline a tiny one for clarity here.
  const visit = (n: t.Node) => {
    if (found) return;
    if (
      t.isIdentifier(n) &&
      /^(?:passport|requireAuth|isAuth|verifyJwt|authMiddleware|authenticate|auth0|clerk)$/i.test(n.name)
    ) {
      found = true;
      return;
    }
    if (t.isMemberExpression(n)) {
      const prop = (n.property as t.Identifier)?.name;
      if (prop && /^(?:user|session|isAuthenticated|auth)$/.test(prop)) {
        const obj = n.object;
        if (t.isIdentifier(obj, { name: 'req' }) || t.isIdentifier(obj, { name: 'request' })) {
          found = true;
          return;
        }
      }
    }
    for (const key of Object.keys(n)) {
      const c = (n as unknown as Record<string, unknown>)[key];
      if (!c) continue;
      if (Array.isArray(c)) {
        for (const x of c) {
          if (x && typeof x === 'object' && (x as Partial<t.Node>).type) visit(x as t.Node);
        }
      } else if (typeof c === 'object' && (c as Partial<t.Node>).type) {
        visit(c as t.Node);
      }
    }
  };
  visit(node);
  return found;
}

/* -------------------------------------------------------------------------- */
/* 7. CORS misconfig (call shape rather than substring)                       */
/* -------------------------------------------------------------------------- */

function checkCorsCall(
  call: t.CallExpression,
  filePath: string,
  content: string,
  out: SecurityFinding[]
) {
  const name = getCalleeName(call.callee);
  if (name !== 'cors') return;

  const opts = call.arguments[0] as t.Node | undefined;
  if (!opts) {
    // bare cors() — default in many versions is *
    push(out, filePath, content, call, {
      severity: 'medium',
      confidence: 'medium',
      title: 'CORS with Default Config',
      description: 'cors() called with no options. Some versions default to "Access-Control-Allow-Origin: *".',
      fixSuggestion: 'Pass an options object with an explicit origin allowlist.',
      category: 'CORS Misconfiguration',
    });
    return;
  }
  if (!t.isObjectExpression(opts)) return;

  // origin: "*" or origin: true
  const originProp = opts.properties.find(
    (p): p is t.ObjectProperty =>
      t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'origin' })
  );
  const credsProp = opts.properties.find(
    (p): p is t.ObjectProperty =>
      t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'credentials' })
  );

  const wildcard =
    !!originProp &&
    ((t.isStringLiteral(originProp.value) && originProp.value.value === '*') ||
      t.isBooleanLiteral(originProp.value, { value: true }));

  if (wildcard) {
    const credsTrue = !!credsProp && t.isBooleanLiteral(credsProp.value, { value: true });
    push(out, filePath, content, call, {
      severity: credsTrue ? 'high' : 'medium',
      confidence: 'high',
      title: credsTrue
        ? 'CORS Wildcard Origin With Credentials'
        : 'CORS Allowing All Origins',
      description: credsTrue
        ? '`origin: "*" || true` with `credentials: true` is invalid (browser refuses) AND dangerous if it ever works.'
        : 'CORS allows requests from any origin.',
      fixSuggestion:
        'Define an allowlist (`origin: [...]`) or a function that returns true only for known hosts.',
      category: 'CORS Misconfiguration',
    });
  }
}

/* -------------------------------------------------------------------------- */
/* 8. innerHTML = <expr that reads req.*>                                     */
/* -------------------------------------------------------------------------- */

function checkInnerHtmlAssignment(
  node: t.AssignmentExpression,
  filePath: string,
  content: string,
  out: SecurityFinding[]
) {
  if (node.operator !== '=') return;
  const left = node.left;
  if (!t.isMemberExpression(left) || left.computed) return;
  const prop = (left.property as t.Identifier)?.name;
  if (prop !== 'innerHTML' && prop !== 'outerHTML') return;
  if (!containsReqAccess(node.right)) return;

  push(out, filePath, content, node, {
    severity: 'high',
    confidence: 'high',
    title: 'innerHTML with user input',
    description: `${prop} is being assigned a value that reads from req.*. DOM-based XSS.`,
    fixSuggestion:
      'Use textContent (escapes), or sanitize with DOMPurify before assigning to innerHTML.',
    category: 'XSS',
  });
}

/* -------------------------------------------------------------------------- */
/* 9. <element dangerouslySetInnerHTML={{__html: req.*}}>                     */
/* -------------------------------------------------------------------------- */

function checkDangerouslySetInnerHTML(
  attr: t.JSXAttribute,
  filePath: string,
  content: string,
  out: SecurityFinding[]
) {
  if (!t.isJSXIdentifier(attr.name) || attr.name.name !== 'dangerouslySetInnerHTML') return;
  const v = attr.value;
  if (!t.isJSXExpressionContainer(v)) return;
  if (!t.isObjectExpression(v.expression)) return;
  const htmlProp = v.expression.properties.find(
    (p): p is t.ObjectProperty =>
      t.isObjectProperty(p) && t.isIdentifier(p.key, { name: '__html' })
  );
  if (!htmlProp) return;
  if (!containsReqAccess(htmlProp.value)) return;

  push(out, filePath, content, attr, {
    severity: 'high',
    confidence: 'high',
    title: 'dangerouslySetInnerHTML with user input',
    description: 'React dangerouslySetInnerHTML is being assigned an expression that reads from req.* — XSS.',
    fixSuggestion:
      'Render the value as text (default React escaping) or pass through DOMPurify.sanitize() first.',
    category: 'XSS',
  });
}

/* -------------------------------------------------------------------------- */
/* 10. Hardcoded secrets in var declarations + literals                       */
/* -------------------------------------------------------------------------- */

const SECRET_NAME_RE = /^(?:api_?key|secret|password|passwd|pwd|token|private_?key|aws_?secret|client_?secret)$/i;

function checkHardcodedSecret(
  node: t.VariableDeclarator,
  filePath: string,
  content: string,
  out: SecurityFinding[]
) {
  if (!t.isIdentifier(node.id)) return;
  if (!SECRET_NAME_RE.test(node.id.name)) return;
  const init = node.init;
  if (!init || !t.isStringLiteral(init)) return;
  if (init.value.length < 8) return; // probably a placeholder
  if (/^\$\{/.test(init.value) || init.value.includes('process.env')) return;

  push(out, filePath, content, node, {
    severity: 'critical',
    confidence: 'high',
    title: `Hardcoded ${node.id.name}`,
    description: `\`${node.id.name}\` is initialized with a string literal in source.`,
    fixSuggestion: 'Read from process.env or a secret store. Never commit secrets to version control.',
    category: 'Hardcoded Secrets',
  });
}

const SECRET_LITERAL_RE = [
  /^(?:AKIA|ASIA)[A-Z0-9]{16}$/,                       // AWS access key
  /^ghp_[A-Za-z0-9]{36}$/,                              // GitHub PAT
  /^gho_[A-Za-z0-9]{36}$/,                              // GitHub OAuth
  /^xox[bporsa]-[A-Za-z0-9-]+$/,                        // Slack
  /^sk-[A-Za-z0-9]{20,}$/,                              // OpenAI / Stripe
  /^sk_live_[A-Za-z0-9]{24,}$/,                         // Stripe live
];

function checkSecretStringLiteral(
  node: t.StringLiteral,
  filePath: string,
  content: string,
  out: SecurityFinding[]
) {
  const v = node.value;
  if (v.length < 16) return;
  if (!SECRET_LITERAL_RE.some((re) => re.test(v))) return;

  push(out, filePath, content, node, {
    severity: 'critical',
    confidence: 'high',
    title: 'Hardcoded secret literal',
    description: `Literal matches a known secret prefix (AWS / GitHub / Slack / Stripe / OpenAI).`,
    fixSuggestion: 'Rotate this secret immediately, then read from process.env.',
    category: 'Hardcoded Secrets',
  });
}

/* -------------------------------------------------------------------------- */
/* 11. Sensitive returns — `return { password, ... }` or `res.json({pw...})`  */
/* -------------------------------------------------------------------------- */

function checkSensitiveReturn(
  node: t.VariableDeclarator | t.ReturnStatement,
  filePath: string,
  content: string,
  out: SecurityFinding[]
) {
  const expr = t.isReturnStatement(node) ? node.argument : node.init;
  if (!expr || !t.isObjectExpression(expr)) return;
  if (!hasPropertyNamed(expr, ['password', 'passwordhash', 'pwd', 'secret', 'token', 'access_token'])) return;

  push(out, filePath, content, node, {
    severity: 'high',
    confidence: 'medium',
    title: 'Sensitive Field in Returned Object',
    description: 'An object returned from this location contains a property named password/secret/token. Verify it isn\'t shipped to clients.',
    fixSuggestion: 'Strip sensitive fields before returning. Use a projection (Prisma select / Drizzle column list) at the DB layer.',
    category: 'Sensitive Data Exposure',
  });
}

/* -------------------------------------------------------------------------- */
/* Project-level checks (unchanged behavior)                                  */
/* -------------------------------------------------------------------------- */

function checkMissingRateLimit(
  allDeps: string[],
  findings: SecurityFinding[],
  projectPath: string
) {
  const hasRateLimit = allDeps.some(
    (d) => d.includes('rate-limit') || d.includes('ratelimit')
  );
  if (!hasRateLimit) {
    findings.push({
      severity: 'medium',
      confidence: 'medium',
      title: 'Missing Rate Limiting',
      description:
        'No rate-limit package detected. Auth endpoints in particular should be rate-limited against brute-force.',
      filePath: `${projectPath}/package.json`,
      lineNumber: 1,
      codeSnippet: '',
      fixSuggestion:
        'Install express-rate-limit, @fastify/rate-limit, or roll a Redis-backed limiter.',
      category: 'Rate Limiting',
    });
  }
}

function checkInsecureDependencies(allDeps: string[], findings: SecurityFinding[]) {
  const vulnerable: Record<string, { severity: Severity; reason: string }> = {
    lodash: { severity: 'medium', reason: 'Versions < 4.17.21 — prototype pollution CVE-2021-23337' },
    minimist: { severity: 'medium', reason: 'Versions < 1.2.6 — prototype pollution' },
    axios: { severity: 'medium', reason: 'Versions < 0.21.1 — SSRF CVE-2020-28168' },
    jsonwebtoken: { severity: 'high', reason: 'Versions < 9.0.0 — algorithm confusion' },
    express: { severity: 'medium', reason: 'Versions < 4.17.3 — qs dep CVE' },
    'node-fetch': { severity: 'low', reason: 'Versions < 2.6.7 — info disclosure' },
    semver: { severity: 'high', reason: 'Versions < 7.5.2 — ReDoS CVE-2022-25883' },
    'word-wrap': { severity: 'medium', reason: 'Versions < 1.2.4 — ReDoS' },
  };
  for (const dep of allDeps) {
    const v = vulnerable[dep];
    if (v) {
      findings.push({
        severity: v.severity,
        confidence: 'low',
        title: `Potentially Vulnerable Dependency: ${dep}`,
        description: v.reason,
        filePath: 'package.json',
        lineNumber: 1,
        codeSnippet: `"${dep}": "…"`,
        fixSuggestion: `Run npm/pnpm audit; update ${dep} to a patched version.`,
        category: 'Vulnerable Dependencies',
      });
    }
  }
}

function checkMissingSecurityHeaders(
  fileContents: Record<string, string>,
  findings: SecurityFinding[]
) {
  const all = Object.values(fileContents).join('\n');
  const hasHelmet = /helmet|@fastify\/helmet|hsts|X-Frame-Options/.test(all);
  const isWebApp = /express\s*\(|fastify\s*\(|http\.createServer|Bun\.serve/.test(all);
  if (isWebApp && !hasHelmet) {
    findings.push({
      severity: 'medium',
      confidence: 'medium',
      title: 'Missing Security Headers',
      description: 'Web app detected but no helmet / equivalent middleware found.',
      filePath: 'app entry file',
      lineNumber: 1,
      codeSnippet: '',
      fixSuggestion:
        'Install helmet (Express) or @fastify/helmet and register it globally. Configure CSP and HSTS.',
      category: 'Security Headers',
    });
  }
}

/* -------------------------------------------------------------------------- */
/* File loader (used only when caller doesn't pre-populate fileContents)      */
/* -------------------------------------------------------------------------- */

async function loadFileContents(projectPath: string): Promise<Record<string, string>> {
  const fileContents: Record<string, string> = {};
  const patterns = [
    '**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}',
    '!**/node_modules/**',
    '!**/.git/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/*.min.js',
  ];
  const files = await glob(patterns, { cwd: projectPath, absolute: false });
  for (const f of files) {
    try {
      fileContents[f] = readFileSync(join(projectPath, f), 'utf-8');
    } catch {
      // skip unreadable
    }
  }
  return fileContents;
}
