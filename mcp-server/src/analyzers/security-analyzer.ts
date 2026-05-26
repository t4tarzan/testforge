// Security analyzer — AST-based static analysis with intra-procedural taint
// tracking. Phase 2 of strengthen-the-spine (Phase 1 introduced the AST
// engine; Phase 2 generalizes taint beyond SQL injection).
//
// How the engine works, in one sentence:
//
//   For each file: parse → collect a per-file taint table mapping local
//   variables to their (source, sanitizers) — then on each sink call, ask
//   "is this argument tainted? what's wrapping it?" and emit findings
//   with confidence derived from the answer.
//
// `confidence: 'high'`   — source → sink, NO sanitizer
// `confidence: 'medium'` — source → sink WITH a known sanitizer (review)
// `confidence: 'low'`    — pattern matched but taint engine saw nothing
//
// Project-level checks (rate-limit dep, vulnerable deps, missing helmet)
// stay as dep-list / regex shape — they're config-shape, not code-shape.

import { readFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

import { parseFile, isParseable } from './lib/parse.js';
import { collectSuppressions, isSuppressed } from './lib/suppressions.js';
import {
  getCalleeName,
  hasUnsafeInterpolation,
  isDbQueryCall,
  isStringConcatWithVar,
  nodeLoc,
  snippetForLine,
} from './lib/visitors.js';
import {
  collectTaintTable,
  confidenceFor,
  describeFlow,
  evaluateTaint,
  identifySanitizer,
  type TaintInfo,
  type TaintTable,
} from './lib/taint.js';

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
  /** Per-finding confidence — see file header for semantics. */
  confidence?: Confidence;
  title: string;
  description: string;
  filePath: string;
  lineNumber: number;
  /** 0-based column where the issue starts. */
  column?: number;
  codeSnippet: string;
  fixSuggestion: string;
  category: string;
  /** Phase 2: for taint-flagged findings, the data-flow story. */
  flow?: string;
}

interface SecurityConfig {
  projectPath: string;
  fileContents: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const PER_FILE_MS = 350; // small bump for the second traversal in Phase 2

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
    findings.push(...analyzeFile(filePath, content));
  }

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
        description: 'File exceeds the 500 KB analyzer cap. Likely generated / bundled output.',
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
          : 'Babel parser rejected this file.',
        filePath,
        lineNumber: 1,
        codeSnippet: '',
        fixSuggestion: 'Verify the file compiles; if it does, the analyzer plugin list may need extending.',
        category: 'Coverage',
      },
    ];
  }

  const isTestFile = /\.(?:test|spec)\.[mc]?[jt]sx?$/.test(filePath) || filePath.endsWith('.d.ts');
  const suppressions = collectSuppressions(parsed.ast);

  // Phase 2: a per-file taint table populated in a single pass.
  const taintTable = collectTaintTable(parsed.ast);

  const raw: SecurityFinding[] = [];

  try {
    traverse(parsed.ast, {
      enter(path) {
        if (Date.now() - startedAt > PER_FILE_MS) {
          path.stop();
          return;
        }
      },
      CallExpression(path) {
        checkSqlInjectionSink(path.node, filePath, content, raw, taintTable);
        checkRceSinks(path.node, filePath, content, raw, taintTable);
        checkPathTraversalSink(path.node, filePath, content, raw, taintTable);
        checkOpenRedirectSink(path.node, filePath, content, raw, taintTable);
        checkReflectedXssSink(path.node, filePath, content, raw, taintTable);
        checkAuthBypassRoute(path.node, filePath, content, raw, isTestFile);
        checkCorsCall(path.node, filePath, content, raw);
        checkSensitiveResponseJson(path.node, filePath, content, raw);
      },
      AssignmentExpression(path) {
        checkInnerHtmlAssignmentSink(path.node, filePath, content, raw, taintTable);
      },
      JSXAttribute(path) {
        checkDangerouslySetInnerHTMLSink(path.node, filePath, content, raw, taintTable);
      },
      VariableDeclarator(path) {
        checkHardcodedSecret(path.node, filePath, content, raw);
      },
      StringLiteral(path) {
        checkSecretStringLiteral(path.node, filePath, content, raw);
      },
    });
  } catch (e) {
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

  return raw.filter((f) => !isSuppressed(suppressions, f.lineNumber, f.category));
}

/* -------------------------------------------------------------------------- */
/* Emit helper                                                                */
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
/* Generic sink helper                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Inspect an argument for taint. If found, return a partial finding (the
 * caller fills in title/severity/category). If the argument is also
 * "intrinsically dangerous" (e.g. a template literal with interpolation in
 * a db.query) we promote to medium confidence even without an explicit
 * source — keeps coverage for project-internal helpers we can't fully model.
 */
interface SinkArgReport {
  confidence: Confidence;
  taint: TaintInfo | null;
  /** True when the arg is a tainted-shape (template with vars, concat) even if no source could be pinned. */
  shapeBased: boolean;
}

function analyzeSinkArg(arg: t.Node | null | undefined, table: TaintTable): SinkArgReport | null {
  if (!arg) return null;
  const taint = evaluateTaint(arg, table);
  if (taint) {
    return {
      confidence: confidenceFor(taint) ?? 'low',
      taint,
      shapeBased: false,
    };
  }
  // Fallback: shape-based detection. If the argument is a template literal
  // with interpolations or a string-concat-with-variable, it's worth
  // flagging at low confidence — variable-built strings reach sinks in
  // patterns we can't statically prove are tainted.
  if (hasUnsafeInterpolation(arg) || isStringConcatWithVar(arg)) {
    return { confidence: 'low', taint: null, shapeBased: true };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* 1. SQL / NoSQL injection                                                   */
/* -------------------------------------------------------------------------- */

function checkSqlInjectionSink(
  call: t.CallExpression,
  filePath: string,
  content: string,
  out: SecurityFinding[],
  table: TaintTable
) {
  const name = getCalleeName(call.callee);
  if (!isDbQueryCall(name)) return;

  const arg = call.arguments[0];
  if (!arg) return;
  const report = analyzeSinkArg(arg as t.Node, table);
  if (!report) return;

  push(out, filePath, content, call, {
    severity: 'critical',
    confidence: report.confidence,
    title: 'Potential SQL/NoSQL Injection',
    description: report.taint
      ? `${name}() argument ${describeFlow(report.taint)}.`
      : `${name}() is called with a string built from variables. Verify the inputs are bound, not concatenated.`,
    fixSuggestion:
      'Use parameterized queries (placeholders like $1, $2) or an ORM. ' +
      'If you must build dynamic SQL, allowlist the variable parts and pass user values via bound parameters.',
    category: 'SQL Injection',
    flow: report.taint ? describeFlow(report.taint) : undefined,
  });
}

/* -------------------------------------------------------------------------- */
/* 2. RCE sinks: eval, Function ctor, child_process.exec, setTimeout("…")     */
/* -------------------------------------------------------------------------- */

function checkRceSinks(
  call: t.CallExpression,
  filePath: string,
  content: string,
  out: SecurityFinding[],
  table: TaintTable
) {
  const name = getCalleeName(call.callee);
  const arg = call.arguments[0] as t.Node | undefined;

  // eval(…)
  if (name === 'eval') {
    const report = arg ? analyzeSinkArg(arg, table) : null;
    push(out, filePath, content, call, {
      severity: 'critical',
      confidence: report?.confidence ?? 'medium',
      title: 'eval() Usage',
      description: report?.taint
        ? `eval() argument ${describeFlow(report.taint)} — direct RCE.`
        : 'eval() executes arbitrary code. Avoid in production code.',
      fixSuggestion:
        'Replace eval with JSON.parse for JSON, a real parser for DSLs, or an explicit dispatch table for known commands.',
      category: 'Dangerous Functions',
      flow: report?.taint ? describeFlow(report.taint) : undefined,
    });
    return;
  }

  // new Function("…") — handled by NewExpression detection? No, Function() is
  // sometimes called without `new` and still produces a function. Either form
  // is bad if it takes user input.
  if (name === 'Function') {
    const report = arg ? analyzeSinkArg(arg, table) : null;
    push(out, filePath, content, call, {
      severity: 'critical',
      confidence: report?.confidence ?? 'medium',
      title: 'Function() Constructor',
      description: report?.taint
        ? `Function() argument ${describeFlow(report.taint)} — RCE.`
        : 'Function() creates a function from a string — equivalent to eval().',
      fixSuggestion: 'Use a real function declaration or a safe dispatch table.',
      category: 'Dangerous Functions',
      flow: report?.taint ? describeFlow(report.taint) : undefined,
    });
    return;
  }

  // child_process.exec / execSync — taint of the command string is RCE
  if (/(?:^|\.)(exec|execSync)$/.test(name) && /child_process/.test(name)) {
    const report = arg ? analyzeSinkArg(arg, table) : null;
    push(out, filePath, content, call, {
      severity: 'critical',
      confidence: report?.confidence ?? 'medium',
      title: 'Shell Command Execution',
      description: report?.taint
        ? `exec() command string ${describeFlow(report.taint)} — command injection.`
        : 'child_process.exec runs a shell. Prefer execFile/spawn with arg arrays.',
      fixSuggestion:
        'Switch to execFile() or spawn() with the command and args as separate arguments. Never let user input reach the shell.',
      category: 'Dangerous Functions',
      flow: report?.taint ? describeFlow(report.taint) : undefined,
    });
    return;
  }

  // setTimeout/setInterval with a string body → eval-equivalent
  if ((name === 'setTimeout' || name === 'setInterval') && arg && t.isStringLiteral(arg)) {
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
/* 3. Path traversal — fs reads & path builders                               */
/* -------------------------------------------------------------------------- */

const FS_NAMES = new Set([
  'readFile', 'readFileSync', 'createReadStream', 'sendFile', 'open', 'openSync',
  'writeFile', 'writeFileSync', 'appendFile', 'unlink', 'unlinkSync',
]);

function checkPathTraversalSink(
  call: t.CallExpression,
  filePath: string,
  content: string,
  out: SecurityFinding[],
  table: TaintTable
) {
  const name = getCalleeName(call.callee);
  const tail = name.split('.').pop() || '';
  const isFs = FS_NAMES.has(tail);
  const isPathBuild = name === 'path.join' || name === 'path.resolve';
  if (!isFs && !isPathBuild) return;

  // First non-callback argument is the file path
  const pathArg = call.arguments[0] as t.Node | undefined;
  const report = analyzeSinkArg(pathArg, table);
  if (!report) return;

  push(out, filePath, content, call, {
    severity: 'high',
    confidence: report.confidence,
    title: 'Path Traversal Risk',
    description: report.taint
      ? `${name}() path ${describeFlow(report.taint)}.`
      : `${name}() path was built from a variable. Verify it can't escape the intended directory.`,
    fixSuggestion:
      'Resolve to an absolute path, then verify the result starts with the expected base directory. ' +
      'Allowlist file ids → server-resolved paths, never echo user paths back.',
    category: 'Path Traversal',
    flow: report.taint ? describeFlow(report.taint) : undefined,
  });
}

/* -------------------------------------------------------------------------- */
/* 4. Open redirect                                                            */
/* -------------------------------------------------------------------------- */

function checkOpenRedirectSink(
  call: t.CallExpression,
  filePath: string,
  content: string,
  out: SecurityFinding[],
  table: TaintTable
) {
  const name = getCalleeName(call.callee);
  if (!/(?:^|\.)redirect$/.test(name)) return;
  const arg = call.arguments[call.arguments.length - 1] as t.Node | undefined;
  const report = analyzeSinkArg(arg, table);
  if (!report) return;

  push(out, filePath, content, call, {
    severity: 'medium',
    confidence: report.confidence,
    title: 'Unvalidated Redirect',
    description: report.taint
      ? `${name}() target ${describeFlow(report.taint)}. Open-redirect / phishing vector.`
      : `${name}() target was built from a variable. Confirm it's checked against an allowlist.`,
    fixSuggestion:
      'Validate the redirect against an explicit allowlist of paths or domains. Prefer internal route names over URL parameters.',
    category: 'Open Redirect',
    flow: report.taint ? describeFlow(report.taint) : undefined,
  });
}

/* -------------------------------------------------------------------------- */
/* 5. Reflected XSS — res.send / res.write / res.render with tainted arg      */
/* -------------------------------------------------------------------------- */

function checkReflectedXssSink(
  call: t.CallExpression,
  filePath: string,
  content: string,
  out: SecurityFinding[],
  table: TaintTable
) {
  const callee = call.callee;
  if (!t.isMemberExpression(callee) || callee.computed) return;
  const propName = t.isIdentifier(callee.property) ? callee.property.name : '';
  if (!['send', 'write', 'render'].includes(propName)) return;
  const obj = callee.object;
  if (!t.isIdentifier(obj) || !['res', 'response', 'reply', 'ctx'].includes(obj.name)) return;

  const arg = call.arguments[0] as t.Node | undefined;
  const report = analyzeSinkArg(arg, table);
  if (!report) return;

  push(out, filePath, content, call, {
    severity: 'high',
    confidence: report.confidence,
    title: 'Unsanitized User Input in Response',
    description: report.taint
      ? `${obj.name}.${propName}() echoes data that ${describeFlow(report.taint)}.`
      : `${obj.name}.${propName}() echoes a value built from variables.`,
    fixSuggestion:
      'Escape with a templating engine, or use res.json() with a strict Content-Type. ' +
      'For HTML, sanitize with DOMPurify or sanitize-html before responding.',
    category: 'XSS',
    flow: report.taint ? describeFlow(report.taint) : undefined,
  });
}

/* -------------------------------------------------------------------------- */
/* 6. innerHTML / outerHTML assignment with tainted RHS                        */
/* -------------------------------------------------------------------------- */

function checkInnerHtmlAssignmentSink(
  node: t.AssignmentExpression,
  filePath: string,
  content: string,
  out: SecurityFinding[],
  table: TaintTable
) {
  if (node.operator !== '=') return;
  const left = node.left;
  if (!t.isMemberExpression(left) || left.computed) return;
  const prop = (left.property as t.Identifier)?.name;
  if (prop !== 'innerHTML' && prop !== 'outerHTML') return;

  const report = analyzeSinkArg(node.right, table);
  if (!report) return;

  push(out, filePath, content, node, {
    severity: 'high',
    confidence: report.confidence,
    title: `${prop} with user input`,
    description: report.taint
      ? `${prop} assigned a value that ${describeFlow(report.taint)}. DOM-based XSS.`
      : `${prop} assigned a value built from variables. Verify it's escaped.`,
    fixSuggestion:
      'Use textContent for plain text. For HTML, sanitize with DOMPurify before assigning.',
    category: 'XSS',
    flow: report.taint ? describeFlow(report.taint) : undefined,
  });
}

/* -------------------------------------------------------------------------- */
/* 7. dangerouslySetInnerHTML with tainted __html                              */
/* -------------------------------------------------------------------------- */

function checkDangerouslySetInnerHTMLSink(
  attr: t.JSXAttribute,
  filePath: string,
  content: string,
  out: SecurityFinding[],
  table: TaintTable
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
  const report = analyzeSinkArg(htmlProp.value as t.Node, table);
  if (!report) return;

  push(out, filePath, content, attr, {
    severity: 'high',
    confidence: report.confidence,
    title: 'dangerouslySetInnerHTML with user input',
    description: report.taint
      ? `__html ${describeFlow(report.taint)} — XSS.`
      : '__html is built from a variable. Verify it\'s sanitized.',
    fixSuggestion: 'Render the value as text (default React escaping) or run it through DOMPurify.sanitize() first.',
    category: 'XSS',
    flow: report.taint ? describeFlow(report.taint) : undefined,
  });
}

/* -------------------------------------------------------------------------- */
/* 8. Auth bypass (heuristic — non-taint-based)                                */
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
  const callee = call.callee;
  if (!t.isMemberExpression(callee) || callee.computed) return;
  const propName = t.isIdentifier(callee.property) ? callee.property.name : '';
  if (!ROUTE_METHODS.has(propName)) return;
  const obj = callee.object;
  if (!t.isIdentifier(obj) || !['router', 'app', 'fastify'].includes(obj.name)) return;

  if (call.arguments.length > 2) return; // probably has middleware
  const handler = call.arguments[call.arguments.length - 1] as t.Node | undefined;
  if (!handler || containsAuthTokenLike(handler)) return;

  push(out, filePath, content, call, {
    severity: 'high',
    confidence: 'low',
    title: 'Route Without Inline Auth',
    description: `${obj.name}.${propName}() declares a route with no visible auth middleware. ` +
      `If your app uses a global auth middleware, suppress this with a comment.`,
    fixSuggestion:
      'Either pass an auth middleware function in the args list, or annotate the file with ' +
      '`// testforge-disable-file authentication-bypass` if a global middleware is intentional.',
    category: 'Authentication Bypass',
  });
}

function containsAuthTokenLike(node: t.Node): boolean {
  let found = false;
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
        for (const x of c) if (x && typeof x === 'object' && (x as Partial<t.Node>).type) visit(x as t.Node);
      } else if (typeof c === 'object' && (c as Partial<t.Node>).type) {
        visit(c as t.Node);
      }
    }
  };
  visit(node);
  return found;
}

/* -------------------------------------------------------------------------- */
/* 9. CORS misconfig — call shape, not taint                                  */
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
        ? '`origin: "*"|true` with `credentials: true` is invalid (browser refuses) AND dangerous.'
        : 'CORS allows requests from any origin.',
      fixSuggestion: 'Define an allowlist (`origin: [...]`) or a function that returns true only for known hosts.',
      category: 'CORS Misconfiguration',
    });
  }
}

/* -------------------------------------------------------------------------- */
/* 10. res.json({password: …}) — shape-based, not taint                       */
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
  const sensitive = ['password', 'passwordhash', 'pwd', 'secret', 'token', 'access_token', 'refresh_token'];
  const matched = findPropertyName(arg, sensitive);
  if (!matched) return;

  push(out, filePath, content, call, {
    severity: 'high',
    confidence: 'high',
    title: `${matched} field in response body`,
    description: `${obj.name}.json() is shipping an object with a \`${matched}\` property.`,
    fixSuggestion:
      'Strip sensitive fields before responding. Use a projection (Drizzle column list / Prisma select) at the DB layer so the field never enters the response object.',
    category: 'Sensitive Data Exposure',
  });
}

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
/* 11. Hardcoded named secrets in var declarators                              */
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
  if (init.value.length < 8) return;
  if (init.value.includes('process.env')) return;

  push(out, filePath, content, node, {
    severity: 'critical',
    confidence: 'high',
    title: `Hardcoded ${node.id.name}`,
    description: `\`${node.id.name}\` is initialized with a string literal in source.`,
    fixSuggestion: 'Read from process.env or a secret store. Never commit secrets to version control.',
    category: 'Hardcoded Secrets',
  });
}

/* -------------------------------------------------------------------------- */
/* 12. Known-secret string literals (AWS, GitHub, Stripe …)                   */
/* -------------------------------------------------------------------------- */

const SECRET_LITERAL_RE = [
  /^(?:AKIA|ASIA)[A-Z0-9]{16}$/,
  /^ghp_[A-Za-z0-9]{36}$/,
  /^gho_[A-Za-z0-9]{36}$/,
  /^xox[bporsa]-[A-Za-z0-9-]+$/,
  /^sk-[A-Za-z0-9]{20,}$/,
  /^sk_live_[A-Za-z0-9]{24,}$/,
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
    description: 'Literal matches a known secret prefix (AWS / GitHub / Slack / Stripe / OpenAI).',
    fixSuggestion: 'Rotate this secret immediately, then read from process.env.',
    category: 'Hardcoded Secrets',
  });
}

/* -------------------------------------------------------------------------- */
/* Project-level checks                                                       */
/* -------------------------------------------------------------------------- */

function checkMissingRateLimit(
  allDeps: string[],
  findings: SecurityFinding[],
  projectPath: string
) {
  const hasRateLimit = allDeps.some((d) => d.includes('rate-limit') || d.includes('ratelimit'));
  if (!hasRateLimit) {
    findings.push({
      severity: 'medium',
      confidence: 'medium',
      title: 'Missing Rate Limiting',
      description: 'No rate-limit package detected. Auth endpoints in particular should be rate-limited.',
      filePath: `${projectPath}/package.json`,
      lineNumber: 1,
      codeSnippet: '',
      fixSuggestion: 'Install express-rate-limit, @fastify/rate-limit, or roll a Redis-backed limiter.',
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
/* File loader                                                                */
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
