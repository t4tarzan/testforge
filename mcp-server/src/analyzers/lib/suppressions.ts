// Inline suppression comments — same shape as eslint-disable / biome-ignore.
//
//   // testforge-disable-next-line <category>
//   // testforge-disable-file <category>
//
// `<category>` can be omitted to suppress every finding on that line / in
// the file. Multiple categories comma-separated:
//   // testforge-disable-next-line sql-injection, xss
//
// Category strings are normalized to lowercase and `-` ↔ ` ` interchangeable
// so users can write either `sql-injection` or `"SQL Injection"`.

import type { File, Comment } from '@babel/types';

const NEXT_LINE = /^[\s/*]*testforge-disable-next-line(?:\s+(.+))?\s*$/i;
const FILE_WIDE = /^[\s/*]*testforge-disable-file(?:\s+(.+))?\s*$/i;

function normCategory(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function parseCategoryList(s: string | undefined): string[] {
  if (!s) return ['*'];
  return s.split(',').map(normCategory).filter(Boolean);
}

export interface SuppressionTable {
  /** "line:category" or "line:*". */
  byLine: Set<string>;
  /** Just "category" or "*". */
  byFile: Set<string>;
}

export function collectSuppressions(ast: File): SuppressionTable {
  const byLine = new Set<string>();
  const byFile = new Set<string>();

  const comments: Comment[] = ast.comments || [];
  for (const c of comments) {
    const value = c.value;
    if (!c.loc) continue;

    const m1 = NEXT_LINE.exec(value);
    if (m1) {
      const cats = parseCategoryList(m1[1]);
      const targetLine = c.loc.end.line + 1; // the comment is *above* the target
      for (const cat of cats) byLine.add(`${targetLine}:${cat}`);
      continue;
    }
    const m2 = FILE_WIDE.exec(value);
    if (m2) {
      const cats = parseCategoryList(m2[1]);
      for (const cat of cats) byFile.add(cat);
    }
  }

  return { byLine, byFile };
}

export function isSuppressed(table: SuppressionTable, line: number, category: string): boolean {
  const cat = normCategory(category);
  return (
    table.byFile.has('*') ||
    table.byFile.has(cat) ||
    table.byLine.has(`${line}:*`) ||
    table.byLine.has(`${line}:${cat}`)
  );
}
