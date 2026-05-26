// Single entry point for turning a source file into an AST.
//
// The security analyzer used to scan with line-level regex — fast but
// blind to context. The AST gives us scope, lexical structure, and
// node-precise locations so we can say "this `eval(` call took its first
// argument from `req.body`" instead of "this line contains the string `eval(`."
//
// We use Babel rather than the TypeScript compiler API because:
//   - It accepts TS/TSX without requiring tsconfig wiring
//   - errorRecovery lets us still analyze a file with a syntax error in it
//   - The visitor pattern via @babel/traverse is well-documented
//   - It handles modern proposals (decorators, top-level await) out of the box
//
// Returns `null` if parsing fails completely — callers should not fail the
// whole run when one file can't be parsed.

import { parse } from '@babel/parser';
import type { ParserOptions } from '@babel/parser';
import type { File } from '@babel/types';

const COMMON_PLUGINS: ParserOptions['plugins'] = [
  'jsx',
  'typescript',
  'decorators-legacy',
  'dynamicImport',
  'topLevelAwait',
  'classProperties',
  'classPrivateProperties',
  'classPrivateMethods',
  'numericSeparator',
  'optionalChaining',
  'nullishCoalescingOperator',
  'logicalAssignment',
  'exportDefaultFrom',
  'exportNamespaceFrom',
  'importMeta',
];

const MAX_BYTES = 500 * 1024; // 500 KB — anything larger is almost certainly generated

export interface ParseResult {
  /** Successfully parsed AST. `null` if the file was too large or unparseable. */
  ast: File | null;
  /** True if the file was rejected for size (so callers can emit an `info` finding). */
  oversize: boolean;
  /** First parse error message, if any. */
  error?: string;
}

export function parseFile(filename: string, content: string): ParseResult {
  if (content.length > MAX_BYTES) {
    return { ast: null, oversize: true };
  }

  try {
    const ast = parse(content, {
      sourceType: 'unambiguous', // module or script, Babel decides
      sourceFilename: filename,
      // errorRecovery: try to produce a partial AST instead of throwing on
      // the first syntax error. We still set a flag so the caller knows.
      errorRecovery: true,
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      allowUndeclaredExports: true,
      allowImportExportEverywhere: true,
      plugins: COMMON_PLUGINS,
    });
    return { ast, oversize: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ast: null, oversize: false, error: msg };
  }
}

/** File extensions Babel can parse with the plugin set we use. */
export function isParseable(filePath: string): boolean {
  return /\.(?:[mc]?[jt]sx?)$/.test(filePath);
}
