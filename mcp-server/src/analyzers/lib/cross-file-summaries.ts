// Cross-file taint propagation — Phase 4b.
//
// Phase 4a built per-file function summaries. This module makes them
// project-wide: when `b/caller.ts` does `import { runQuery } from './helper'`
// and `./helper.ts` defines `runQuery(q) { db.query(q); }`, the analyzer
// now flags the caller as a SQL-injection sink.
//
// What's in scope:
//   • ESM:  `import { x } from './helper'` (named)
//           `import helper from './helper'` (default — resolves to "default")
//           `import * as helpers from './helper'`
//   • CJS:  `const { x } = require('./helper')`
//           `const helper = require('./helper').helper`
//           `const helpers = require('./helper')` (namespace)
//   • Exports: `export function x(){…}`, `export const x = (…) => …`,
//              `export { x }`, `export default function(…)`,
//              `module.exports.x = …`, `module.exports = { x }`,
//              `exports.x = …`.
//
// Out of scope:
//   • Re-exports (`export { x } from './other'`)
//   • Dynamic imports / require with non-literal specifier
//   • tsconfig path aliases
//   • node_modules resolution

import * as t from '@babel/types';
import { walk } from './visitors.js';
import { resolveRelativeImport } from './module-resolver.js';
import {
  collectFunctionSummariesWithAliases,
  type FunctionSummary,
  type FunctionSummaryTable,
} from './function-summaries.js';

/* -------------------------------------------------------------------------- */
/* Public types                                                                */
/* -------------------------------------------------------------------------- */

export interface CrossFileSummaryTable {
  /** Key: "<resolvedFilePath>::<exportName>". Default export → "<file>::default". */
  byKey: Map<string, FunctionSummary>;
  /** Convenience: the per-file local summaries we already built. */
  perFile: Map<string, FunctionSummaryTable>;
}

/**
 * Map of "local name in *this* file" → "<sourceFile>::<exportedName>"
 * for every import statement in the file. Lets the analyzer turn a call
 * to a local-looking identifier into a lookup in the project summary
 * table.
 */
export type FileImportMap = Map<string, string>;

/* -------------------------------------------------------------------------- */
/* Project-wide collection                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Build the project-wide summary table. Two passes:
 *   1. Per-file, collect local FunctionSummaryTable.
 *   2. Per-file, walk export statements; for each exported function
 *      whose local-summary has sinks, record under `<file>::<name>`.
 *
 * Files that aren't in `asts` are skipped — they're either unparseable
 * or excluded from analysis (node_modules, dist, etc.).
 */
export function collectCrossFileSummaries(
  asts: Map<string, t.File>
): CrossFileSummaryTable {
  const perFile = new Map<string, FunctionSummaryTable>();
  for (const [path, ast] of asts) {
    perFile.set(path, collectFunctionSummariesWithAliases(ast));
  }

  const byKey = new Map<string, FunctionSummary>();
  for (const [path, ast] of asts) {
    const local = perFile.get(path);
    if (!local) continue;
    const exported = collectExportedNames(ast);
    // `exported` maps exported name → local binding name.
    for (const [exportedName, localName] of exported) {
      const summary = local.byName.get(localName);
      if (!summary || summary.sinks.length === 0) continue;
      byKey.set(`${path}::${exportedName}`, summary);
    }
  }

  return { byKey, perFile };
}

/**
 * For a given file, return the map of local identifier names → the
 * cross-file key they refer to. Empty map if the file has no relevant
 * imports / requires.
 */
export function collectFileImports(
  filePath: string,
  ast: t.File,
  candidates: Set<string>
): FileImportMap {
  const result: FileImportMap = new Map();

  walk(ast, (node) => {
    // ── ESM: import { a, b as c } from './foo'  /  import d from './foo' / import * as ns from './foo'
    if (t.isImportDeclaration(node)) {
      const spec = node.source.value;
      const resolved = resolveRelativeImport(filePath, spec, candidates);
      if (!resolved) return true;
      for (const s of node.specifiers) {
        if (t.isImportSpecifier(s)) {
          const imported = t.isIdentifier(s.imported) ? s.imported.name : s.imported.value;
          result.set(s.local.name, `${resolved}::${imported}`);
        } else if (t.isImportDefaultSpecifier(s)) {
          result.set(s.local.name, `${resolved}::default`);
        } else if (t.isImportNamespaceSpecifier(s)) {
          // We can't directly bind ns.X to a cross-file key without
          // following property access at the use site. Skip for now;
          // future enhancement.
        }
      }
      return true;
    }

    // ── CJS: const { a } = require('./foo')  /  const a = require('./foo').b  /  const ns = require('./foo')
    if (t.isVariableDeclarator(node) && node.init) {
      const init = node.init;

      // 1. const x = require('./foo')
      if (isRequireCall(init) && t.isStringLiteral(init.arguments[0])) {
        const spec = init.arguments[0].value;
        const resolved = resolveRelativeImport(filePath, spec, candidates);
        if (!resolved) return true;
        // const { x, y: z } = require('./foo')
        if (t.isObjectPattern(node.id)) {
          for (const p of node.id.properties) {
            if (!t.isObjectProperty(p)) continue;
            const key = t.isIdentifier(p.key) ? p.key.name : (t.isStringLiteral(p.key) ? p.key.value : null);
            if (!key) continue;
            const localName = t.isIdentifier(p.value) ? p.value.name : key;
            result.set(localName, `${resolved}::${key}`);
          }
        } else if (t.isIdentifier(node.id)) {
          // const ns = require('./foo')   ← namespace binding; analyzer
          // can resolve `ns.X` later by consulting the resolved file's
          // exports. We don't bind individual names here, but we record
          // the namespace under a special key so the analyzer can look it up.
          result.set(node.id.name, `${resolved}::*`);
        }
      }

      // 2. const a = require('./foo').b
      if (
        t.isMemberExpression(init) &&
        !init.computed &&
        t.isIdentifier(init.property) &&
        isRequireCall(init.object) &&
        t.isStringLiteral((init.object as t.CallExpression).arguments[0]) &&
        t.isIdentifier(node.id)
      ) {
        const spec = ((init.object as t.CallExpression).arguments[0] as t.StringLiteral).value;
        const resolved = resolveRelativeImport(filePath, spec, candidates);
        if (resolved) {
          result.set(node.id.name, `${resolved}::${init.property.name}`);
        }
      }
    }

    return true;
  });

  return result;
}

function isRequireCall(node: t.Node): node is t.CallExpression {
  return (
    t.isCallExpression(node) &&
    t.isIdentifier(node.callee, { name: 'require' }) &&
    node.arguments.length >= 1
  );
}

/* -------------------------------------------------------------------------- */
/* Export collection                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Returns map of exported-name → local-binding-name for this file.
 *
 * ESM:
 *   export function foo() {}     → { foo → foo }
 *   export const bar = …          → { bar → bar }
 *   export { baz, qux as q }      → { baz → baz, q → qux }
 *   export default function x() {} → { default → x }
 *   export default helper          → { default → helper }
 *
 * CJS:
 *   module.exports.foo = …         → { foo → foo }
 *   module.exports = { a, b: c }   → { a → a, b → c }
 *   exports.foo = bar              → { foo → bar }
 */
function collectExportedNames(ast: t.File): Map<string, string> {
  const result = new Map<string, string>();

  walk(ast, (node) => {
    // ESM named exports: export function x() {}, export const x = …
    if (t.isExportNamedDeclaration(node)) {
      if (node.declaration) {
        if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
          result.set(node.declaration.id.name, node.declaration.id.name);
        } else if (t.isVariableDeclaration(node.declaration)) {
          for (const d of node.declaration.declarations) {
            if (t.isIdentifier(d.id)) result.set(d.id.name, d.id.name);
          }
        }
      }
      for (const s of node.specifiers) {
        if (t.isExportSpecifier(s)) {
          const exported = t.isIdentifier(s.exported) ? s.exported.name : s.exported.value;
          const local = s.local.name;
          result.set(exported, local);
        }
      }
      return true;
    }
    // export default …
    if (t.isExportDefaultDeclaration(node)) {
      const decl = node.declaration;
      if (t.isFunctionDeclaration(decl) && decl.id) {
        result.set('default', decl.id.name);
      } else if (t.isFunctionExpression(decl) || t.isArrowFunctionExpression(decl)) {
        // anonymous — bind under "default" with no friendly local name
        result.set('default', '__default_export__');
      } else if (t.isIdentifier(decl)) {
        result.set('default', decl.name);
      }
      return true;
    }

    // CJS: module.exports.x = … / exports.x = … / module.exports = { … }
    if (t.isAssignmentExpression(node) && node.operator === '=') {
      const left = node.left;
      // module.exports.x = identifier-or-function
      if (
        t.isMemberExpression(left) &&
        !left.computed &&
        t.isMemberExpression(left.object) &&
        t.isIdentifier(left.object.object, { name: 'module' }) &&
        t.isIdentifier(left.object.property, { name: 'exports' }) &&
        t.isIdentifier(left.property)
      ) {
        const exported = left.property.name;
        const localBinding = nameOfRightHandSide(node.right) ?? exported;
        result.set(exported, localBinding);
      }
      // exports.x = …
      if (
        t.isMemberExpression(left) &&
        !left.computed &&
        t.isIdentifier(left.object, { name: 'exports' }) &&
        t.isIdentifier(left.property)
      ) {
        const exported = left.property.name;
        const localBinding = nameOfRightHandSide(node.right) ?? exported;
        result.set(exported, localBinding);
      }
      // module.exports = { a, b: c, foo }
      if (
        t.isMemberExpression(left) &&
        !left.computed &&
        t.isIdentifier(left.object, { name: 'module' }) &&
        t.isIdentifier(left.property, { name: 'exports' }) &&
        t.isObjectExpression(node.right)
      ) {
        for (const p of node.right.properties) {
          if (!t.isObjectProperty(p)) continue;
          const key = t.isIdentifier(p.key) ? p.key.name : (t.isStringLiteral(p.key) ? p.key.value : null);
          if (!key) continue;
          // Shorthand `{ foo }` → local binding is also `foo`. Otherwise
          // `{ foo: bar }` → local is `bar`.
          const localBinding =
            t.isIdentifier(p.value) ? p.value.name : nameOfRightHandSide(p.value as t.Node) ?? key;
          result.set(key, localBinding);
        }
      }
    }

    return true;
  });

  return result;
}

function nameOfRightHandSide(node: t.Node): string | null {
  if (t.isIdentifier(node)) return node.name;
  if (t.isFunctionExpression(node) && node.id) return node.id.name;
  return null;
}

/* -------------------------------------------------------------------------- */
/* Lookup helper                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Resolve a local identifier (in some file's analysis pass) to its
 * cross-file summary, if any. Handles both direct keys and namespace
 * accesses recorded under `<file>::*`. For the namespace case, the
 * caller must pass the property name.
 */
export function lookupCrossFileSummary(
  table: CrossFileSummaryTable,
  imports: FileImportMap,
  localName: string,
  property?: string
): FunctionSummary | null {
  const key = imports.get(localName);
  if (!key) return null;

  // Direct named binding
  if (!key.endsWith('::*')) {
    return table.byKey.get(key) ?? null;
  }

  // Namespace: `ns.X` — caller needs to pass `property`
  if (property) {
    const filePath = key.slice(0, -3); // strip "::*"
    // Building a Map lookup key from two internal strings — not a query.
    // testforge-disable-next-line sql-injection
    return table.byKey.get(`${filePath}::${property}`) ?? null;
  }
  return null;
}
