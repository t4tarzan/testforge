// Structured fix suggestions — Phase 3 of strengthen-the-spine.
//
// 0.3.0 gave us per-finding `confidence`. 0.4.0 added the taint engine
// and a `flow` narrative. Now (0.5.0): for findings where the fix is
// mechanical and unambiguous, we emit a `before` / `after` snippet
// alongside the prose `fixSuggestion`. The dashboard can render it
// inline; the CLI can copy-to-clipboard or stage it as a suggestion.
//
// We DO NOT auto-apply patches in this phase. `applicable: true`
// means "safe to apply mechanically if the user wants to" — the UI
// still asks for confirmation. Real autofix (with import management
// and source-map precision) is Phase 4 territory.
//
// What gets a fix:
//   • SQL injection where the call shape is `db.query(<concat>)` or
//     `db.query(<template literal>)` — we can mechanically rewrite to
//     parameterized form.
//   • innerHTML/outerHTML/dangerouslySetInnerHTML — wrap the RHS in
//     `DOMPurify.sanitize(...)`.
//   • res.send with a tainted argument — wrap in `escape(...)`.
//   • Hardcoded named secret (const password = '...') — substitute
//     `process.env.PASSWORD`.
//   • CORS wildcard origin — placeholder allowlist.
//   • res.json shipping a `password`/`secret`/`token` field — emit a
//     destructure-and-omit pattern.
//
// What gets description-only (no `applicable`):
//   • eval / Function ctor / child_process.exec — refactor needs human
//   • Open redirect — needs allowlist context the analyzer can't infer
//   • Path traversal — same

import * as t from '@babel/types';
import { snippetForLine, nodeLoc } from './visitors.js';

export interface SecurityFix {
  description: string;
  /** Verbatim slice from the source — what gets replaced. */
  before: string;
  /** The corrected form. May contain placeholders like `<env_var_name>`. */
  after: string;
  /** Imports the `after` snippet assumes (e.g. "DOMPurify"). */
  importsNeeded?: string[];
  /**
   * True when the fix is mechanically safe to apply (no human judgment
   * required beyond accepting). False when the analyzer is suggesting
   * the direction but the actual code change needs review.
   */
  applicable: boolean;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Slice the source between two locations. Returns '' if either loc is
 * missing — caller should fall back to a line-based snippet.
 */
function sliceNode(content: string, node: t.Node): string {
  if (!node.loc) return '';
  return sliceRange(content, node.loc.start, node.loc.end);
}

function sliceRange(
  content: string,
  start: { line: number; column: number },
  end: { line: number; column: number }
): string {
  const lines = content.split('\n');
  if (start.line === end.line) {
    return (lines[start.line - 1] ?? '').slice(start.column, end.column);
  }
  const out: string[] = [];
  out.push((lines[start.line - 1] ?? '').slice(start.column));
  for (let i = start.line; i < end.line - 1; i++) {
    out.push(lines[i] ?? '');
  }
  out.push((lines[end.line - 1] ?? '').slice(0, end.column));
  return out.join('\n');
}

/** Best-effort source text for a node. */
function srcOf(content: string, node: t.Node): string {
  const sliced = sliceNode(content, node);
  if (sliced) return sliced;
  const loc = nodeLoc(node);
  return snippetForLine(content, loc.line);
}

/* -------------------------------------------------------------------------- */
/* SQL injection — rewrite to parameterized form                              */
/* -------------------------------------------------------------------------- */

/**
 * Given `db.query(<expr>)`, build `db.query(<placeholders>, [<vars>])`.
 *
 * Works on:
 *   • String concat:        `db.query('SELECT ... WHERE id = ' + req.id)`
 *   • Template literal:     `db.query(`SELECT ... WHERE id = ${req.id}`)`
 *
 * Returns null for shapes we can't safely rewrite (sub-expressions
 * inside the variable, nested function calls, …).
 */
export function buildSqlInjectionFix(
  call: t.CallExpression,
  content: string
): SecurityFix | null {
  const arg = call.arguments[0];
  if (!arg) return null;
  const calleeName = t.isMemberExpression(call.callee) ? srcOf(content, call.callee) : '';

  // Template literal path
  if (t.isTemplateLiteral(arg)) {
    const quasis = arg.quasis.map((q) => q.value.cooked ?? q.value.raw);
    const exprs = arg.expressions;
    if (quasis.length !== exprs.length + 1) return null;

    let queryStr = '';
    const binds: string[] = [];
    for (let i = 0; i < exprs.length; i++) {
      queryStr += quasis[i];
      queryStr += `$${i + 1}`;
      binds.push(srcOf(content, exprs[i] as t.Node));
    }
    queryStr += quasis[quasis.length - 1];

    const before = srcOf(content, call);
    const after = `${calleeName || 'db.query'}(${JSON.stringify(queryStr)}, [${binds.join(', ')}])`;
    return {
      description: 'Use a parameterized query — let the driver bind variables instead of concatenating.',
      before,
      after,
      applicable: true,
    };
  }

  // String concat path: 'literal' + variable [+ 'literal' + variable]…
  if (t.isBinaryExpression(arg) && arg.operator === '+') {
    const parts = flattenConcat(arg);
    if (!parts) return null;
    // Strings remain inline; non-string nodes become $N placeholders.
    let queryStr = '';
    const binds: string[] = [];
    for (const p of parts) {
      if (t.isStringLiteral(p)) {
        queryStr += p.value;
      } else {
        binds.push(srcOf(content, p));
        queryStr += `$${binds.length}`;
      }
    }
    if (binds.length === 0) return null;
    const before = srcOf(content, call);
    const after = `${calleeName || 'db.query'}(${JSON.stringify(queryStr)}, [${binds.join(', ')}])`;
    return {
      description: 'Use a parameterized query — let the driver bind variables instead of concatenating.',
      before,
      after,
      applicable: true,
    };
  }

  // Identifier path: `const q = <concat with req.x>; db.query(q)`.
  //
  // We can't mechanically rewrite this — the actual concatenation lives
  // somewhere else in the file. Emit a descriptive (applicable:false) fix
  // that points the user at the right transformation.
  if (t.isIdentifier(arg)) {
    const before = srcOf(content, call);
    const after =
      `// Where \`${arg.name}\` is built, switch from concatenation to placeholders:\n` +
      `//   const ${arg.name} = 'SELECT … WHERE col = $1';   // bind, don't concat\n` +
      `${calleeName || 'db.query'}(${arg.name}, [/* values matching each $N */])`;
    return {
      description:
        `\`${arg.name}\` carries tainted data into a database call. ` +
        `Locate where \`${arg.name}\` is constructed and switch the concatenation to placeholders ($1, $2 …) ` +
        `with a binds array. The driver will then escape values safely.`,
      before,
      after,
      applicable: false,
    };
  }

  return null;
}

function flattenConcat(node: t.BinaryExpression): t.Node[] | null {
  const out: t.Node[] = [];
  const visit = (n: t.Node): boolean => {
    if (t.isBinaryExpression(n) && n.operator === '+') {
      if (!visit(n.left)) return false;
      if (!visit(n.right)) return false;
      return true;
    }
    out.push(n);
    return true;
  };
  return visit(node) ? out : null;
}

/* -------------------------------------------------------------------------- */
/* DOM XSS — wrap RHS in DOMPurify.sanitize                                   */
/* -------------------------------------------------------------------------- */

/**
 * For `el.innerHTML = <expr>` (or outerHTML / __html in JSX), emit a fix
 * that wraps `<expr>` with `DOMPurify.sanitize(...)`. The `before` is
 * the whole assignment / JSX attribute so the UI can show the full
 * replacement.
 */
export function buildInnerHtmlFix(
  assign: t.AssignmentExpression,
  content: string
): SecurityFix | null {
  if (!t.isMemberExpression(assign.left) || assign.left.computed) return null;
  const prop = assign.left.property;
  if (!t.isIdentifier(prop) || (prop.name !== 'innerHTML' && prop.name !== 'outerHTML')) return null;

  const target = srcOf(content, assign.left);
  const rhsSrc = srcOf(content, assign.right);
  if (!target || !rhsSrc) return null;

  return {
    description: 'Sanitize the HTML before assigning. DOMPurify is the canonical browser library.',
    before: `${target} = ${rhsSrc}`,
    after: `${target} = DOMPurify.sanitize(${rhsSrc})`,
    importsNeeded: ["import DOMPurify from 'dompurify';"],
    applicable: true,
  };
}

/** Same idea for `dangerouslySetInnerHTML={{ __html: <expr> }}` */
export function buildDangerouslySetInnerHtmlFix(
  attr: t.JSXAttribute,
  htmlPropValue: t.Node,
  content: string
): SecurityFix | null {
  const rhsSrc = srcOf(content, htmlPropValue);
  if (!rhsSrc) return null;
  return {
    description: 'Sanitize the HTML before passing to dangerouslySetInnerHTML.',
    before: `dangerouslySetInnerHTML={{ __html: ${rhsSrc} }}`,
    after: `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(${rhsSrc}) }}`,
    importsNeeded: ["import DOMPurify from 'dompurify';"],
    applicable: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Reflected XSS via res.send — wrap arg with escape()                        */
/* -------------------------------------------------------------------------- */

export function buildResSendEscapeFix(
  call: t.CallExpression,
  content: string
): SecurityFix | null {
  const callee = call.callee;
  if (!t.isMemberExpression(callee) || callee.computed) return null;
  const propName = t.isIdentifier(callee.property) ? callee.property.name : '';
  if (!['send', 'write', 'render'].includes(propName)) return null;

  const arg = call.arguments[0];
  if (!arg) return null;
  const argSrc = srcOf(content, arg as t.Node);
  const recv = srcOf(content, callee.object);
  if (!argSrc || !recv) return null;

  // If the argument is a concat or template literal, only the variable parts
  // need escaping — but mechanically wrapping the whole expression is still
  // safe (escape() is idempotent on plain strings).
  return {
    description: 'Escape user-controlled content before sending in an HTML response.',
    before: `${recv}.${propName}(${argSrc})`,
    after: `${recv}.${propName}(escape(${argSrc}))`,
    importsNeeded: ["import escape from 'escape-html';"],
    applicable: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Hardcoded named secret → process.env                                       */
/* -------------------------------------------------------------------------- */

export function buildSecretEnvFix(
  decl: t.VariableDeclarator,
  content: string
): SecurityFix | null {
  if (!t.isIdentifier(decl.id) || !decl.init || !t.isStringLiteral(decl.init)) return null;
  const envName = decl.id.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const before = `${decl.id.name} = ${srcOf(content, decl.init)}`;
  const after = `${decl.id.name} = process.env.${envName}`;
  return {
    description:
      `Move the value to an environment variable. Set ${envName}=... in your .env file ` +
      'and ensure it is loaded (e.g. via dotenv) before this code runs.',
    before,
    after,
    applicable: true,
  };
}

/* -------------------------------------------------------------------------- */
/* CORS wildcard — placeholder allowlist                                      */
/* -------------------------------------------------------------------------- */

export function buildCorsWildcardFix(
  optsObject: t.ObjectExpression,
  content: string
): SecurityFix | null {
  const before = srcOf(content, optsObject);
  if (!before) return null;

  // Replace the origin value with a placeholder array. Other props are
  // preserved by simple string replacement on the rendered source.
  const replaced = before.replace(
    /origin\s*:\s*(?:['"]\*['"]|true)/,
    `origin: ['https://your-domain.com']  // TODO: replace with your allowlist`
  );
  if (replaced === before) return null;

  return {
    description:
      'Replace the wildcard with an explicit allowlist of hosts. Use environment variables in production.',
    before,
    after: replaced,
    applicable: false, // user must supply real hosts; we only sketch the shape
  };
}

/* -------------------------------------------------------------------------- */
/* Sensitive field in res.json — destructure-and-omit                         */
/* -------------------------------------------------------------------------- */

export function buildResponseFieldFix(
  call: t.CallExpression,
  fieldName: string,
  content: string
): SecurityFix | null {
  const callee = call.callee;
  if (!t.isMemberExpression(callee) || callee.computed) return null;
  const propName = t.isIdentifier(callee.property) ? callee.property.name : '';
  if (propName !== 'json') return null;
  const obj = callee.object;
  if (!t.isIdentifier(obj)) return null;

  const arg = call.arguments[0];
  if (!arg || !t.isObjectExpression(arg)) return null;

  // We can rewrite cleanly when the whole object is shaped like
  //   { ...x, password: y, ...z }
  // — and even then the user might prefer a DB-level projection. Emit the
  // suggestion as descriptive (applicable=false) so it's a sketch, not
  // a mechanical patch.
  const argSrc = srcOf(content, arg);
  return {
    description:
      `Strip the \`${fieldName}\` field at the data layer (Drizzle column list / Prisma select / explicit destructure-omit) ` +
      `so it never enters the response object. Example shown below assumes the source object is in scope.`,
    before: `${obj.name}.${propName}(${argSrc})`,
    after:
      `const { ${fieldName}: _omitted, ...safe } = /* source object */;\n` +
      `${obj.name}.${propName}(safe);`,
    applicable: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Path traversal — descriptive only                                          */
/* -------------------------------------------------------------------------- */

export function buildPathTraversalAdvice(
  call: t.CallExpression,
  content: string
): SecurityFix | null {
  const before = srcOf(content, call);
  if (!before) return null;
  return {
    description:
      'Validate the path against an allowlist or restrict to an explicit base directory using path.resolve() then a startsWith check.',
    before,
    after:
      `const BASE = path.resolve('./uploads');\n` +
      `const target = path.resolve(BASE, path.normalize(/* user input */));\n` +
      `if (!target.startsWith(BASE + path.sep)) throw new Error('path escapes base');\n` +
      `// then use \`target\` as the path argument`,
    applicable: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Open redirect — descriptive only                                           */
/* -------------------------------------------------------------------------- */

export function buildOpenRedirectAdvice(
  call: t.CallExpression,
  content: string
): SecurityFix | null {
  const before = srcOf(content, call);
  if (!before) return null;
  return {
    description:
      'Validate the redirect against an allowlist of safe paths or domains. Prefer internal route names over URL parameters.',
    before,
    after:
      `const ALLOWED = ['/home', '/dashboard'];\n` +
      `const next = ALLOWED.includes(req.query.next) ? req.query.next : '/';\n` +
      `res.redirect(next);`,
    applicable: false,
  };
}

/* -------------------------------------------------------------------------- */
/* eval / Function — descriptive only                                         */
/* -------------------------------------------------------------------------- */

export function buildEvalAdvice(
  call: t.CallExpression,
  content: string
): SecurityFix | null {
  const before = srcOf(content, call);
  if (!before) return null;
  return {
    description:
      'eval() and new Function() execute arbitrary code. Replace with JSON.parse for data, a dedicated parser for DSLs, or an explicit dispatch table for known commands.',
    before,
    after:
      `// Pick the appropriate replacement for your use case:\n` +
      `//   JSON.parse(<string>)             — if you wanted a JSON value\n` +
      `//   const HANDLERS = { foo, bar };   — if you wanted command dispatch\n` +
      `//   <real-parser>(<string>)          — if you have a DSL`,
    applicable: false,
  };
}
