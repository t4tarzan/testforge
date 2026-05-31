// AST-aware dead-code detection.
//
// The previous version used `allContent.includes(name)` to decide
// whether an exported symbol was used. That has obvious false-positive
// failure modes:
//   - The symbol's OWN declaration line contains its name → always
//     "used."
//   - A common word like `process`, `data`, `Config` appears in any
//     file that has those identifiers for unrelated reasons.
//   - Comments and string literals count toward "usage."
//
// This version:
//   - Walks each file's AST, collects { declared symbols, imported symbols }
//   - A declared symbol counts as "used" if it shows up as an
//     Identifier reference in another file OR is imported under any name.
//
// Also tightens the unused-dep heuristic: previous regex only matched
// the exact module name (`from 'lodash'`), missing subpath imports like
// `from 'lodash/get'`. The new check is anchored on the module-root
// (`lodash`) so both forms are covered.

import * as t from '@babel/types';
import type { File } from '@babel/types';
import { walk } from './visitors.js';

export interface DeadCodeReport {
  /** Symbols exported by file path → list of names that aren't referenced anywhere else in the project. */
  unusedExports: Array<{ filePath: string; name: string }>;
  /** Dependencies declared in package.json but never imported anywhere. */
  unusedDeps: string[];
}

/**
 * Collect dead-code signals from a project map.
 *
 * @param asts            Already-parsed file ASTs (skip oversize / unparseable)
 * @param dependencies    The project's direct dependencies (from package.json)
 */
export function findDeadCode(asts: Map<string, File>, dependencies: string[]): DeadCodeReport {
  // 1. Per-file: collect declared exports + every identifier *referenced*
  //    (not declared) in this file.
  const exportsByFile = new Map<string, Set<string>>();
  const referencedSymbols = new Set<string>();
  const importedModules = new Set<string>(); // raw module specifiers seen in any import / require

  for (const [filePath, ast] of asts) {
    const declared = new Set<string>();
    const referenced = new Set<string>();
    collectDeclaredAndReferenced(ast, declared, referenced, importedModules);
    exportsByFile.set(filePath, declared);
    for (const s of referenced) referencedSymbols.add(s);
  }

  // 2. Cross-reference: an exported symbol is "dead" if no OTHER file
  //    references its name.
  const unusedExports: DeadCodeReport['unusedExports'] = [];
  for (const [filePath, exported] of exportsByFile) {
    for (const name of exported) {
      // Skip "default" — default exports aren't named at the import
      // site so we can't track them via the name set.
      if (name === 'default') continue;
      // Skip if any other file references this name. We allow the
      // declaring file to reference its own export (that's expected).
      const externallyReferenced = checkExternalReferences(name, filePath, asts, exportsByFile);
      if (!externallyReferenced) {
        unusedExports.push({ filePath, name });
      }
    }
  }

  // 3. Unused dependencies. A dep is "unused" if no module specifier
  //    starts with the dep name (so `lodash` covers both `lodash` and
  //    `lodash/get`).
  const unusedDeps: string[] = [];
  for (const dep of dependencies) {
    const moduleRoot = depModuleRoot(dep);
    let used = false;
    for (const spec of importedModules) {
      if (spec === moduleRoot || spec.startsWith(moduleRoot + '/')) {
        used = true;
        break;
      }
    }
    if (!used) unusedDeps.push(dep);
  }

  return { unusedExports, unusedDeps };
}

/* -------------------------------------------------------------------------- */
/* Per-file declaration / reference collection                                */
/* -------------------------------------------------------------------------- */

function collectDeclaredAndReferenced(
  ast: File,
  declared: Set<string>,
  referenced: Set<string>,
  importedModules: Set<string>
) {
  walk(ast, (node) => {
    // ── Exports
    if (t.isExportNamedDeclaration(node)) {
      if (node.declaration) {
        if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
          declared.add(node.declaration.id.name);
        } else if (t.isClassDeclaration(node.declaration) && node.declaration.id) {
          declared.add(node.declaration.id.name);
        } else if (t.isVariableDeclaration(node.declaration)) {
          for (const d of node.declaration.declarations) {
            if (t.isIdentifier(d.id)) declared.add(d.id.name);
          }
        } else if (t.isTSTypeAliasDeclaration(node.declaration) || t.isTSInterfaceDeclaration(node.declaration)) {
          if (node.declaration.id) declared.add(node.declaration.id.name);
        }
      }
      for (const s of node.specifiers) {
        if (t.isExportSpecifier(s)) {
          const exported = t.isIdentifier(s.exported) ? s.exported.name : s.exported.value;
          declared.add(exported);
        }
      }
    } else if (t.isExportDefaultDeclaration(node)) {
      declared.add('default');
    }
    // ── Imports — record specifier AND mark imported names as referenced
    //    from this file's perspective (so they don't double-count as dead).
    else if (t.isImportDeclaration(node)) {
      importedModules.add(node.source.value);
      for (const s of node.specifiers) {
        if (t.isImportSpecifier(s)) {
          const importedName = t.isIdentifier(s.imported) ? s.imported.name : s.imported.value;
          referenced.add(importedName);
        } else if (t.isImportDefaultSpecifier(s)) {
          referenced.add('default');
        }
      }
    }
    // ── CJS require('foo') AND dynamic import('foo'). The dynamic form
    //    (`await import('stripe')`) is a CallExpression whose callee is an
    //    `Import` node — common in serverless handlers that lazy-load deps.
    //    Missing it flagged every dynamically-imported dep as "unused".
    else if (t.isCallExpression(node)
             && (t.isIdentifier(node.callee, { name: 'require' }) || t.isImport(node.callee))
             && node.arguments.length >= 1 && t.isStringLiteral(node.arguments[0])) {
      importedModules.add(node.arguments[0].value);
    }
    // ── Bare identifier reads (everywhere else) — count as referenced
    else if (t.isIdentifier(node)) {
      // Skip identifier that IS the name being declared (we'll catch
      // foreign references separately). The walker doesn't have parent
      // context, so we accept some over-counting; the externally-only
      // check below corrects for it.
      referenced.add(node.name);
    }
    return true;
  });
}

/**
 * Returns true if `name` appears as a referenced identifier in any
 * file OTHER than `declaringFile`. Cheap implementation: rebuild the
 * referenced set per file at first call. Cached internally.
 */
function checkExternalReferences(
  name: string,
  declaringFile: string,
  asts: Map<string, File>,
  _exportsByFile: Map<string, Set<string>>
): boolean {
  for (const [otherPath, ast] of asts) {
    if (otherPath === declaringFile) continue;
    if (fileReferencesName(ast, name)) return true;
  }
  return false;
}

const fileRefCache = new WeakMap<File, Set<string>>();

function fileReferencesName(ast: File, name: string): boolean {
  let set = fileRefCache.get(ast);
  if (!set) {
    set = new Set<string>();
    walk(ast, (node) => {
      if (t.isIdentifier(node)) set!.add(node.name);
      return true;
    });
    fileRefCache.set(ast, set);
  }
  return set.has(name);
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Normalize a dep entry to its module root. `@scope/pkg@1.0.0` → `@scope/pkg`. */
function depModuleRoot(dep: string): string {
  if (dep.startsWith('@')) {
    const scoped = dep.slice(1).split('@')[0];
    return '@' + scoped;
  }
  return dep.split('@')[0];
}
