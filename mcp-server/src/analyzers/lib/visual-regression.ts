// AST-aware visual-regression signal detection.
//
// The prior version used substrings:
//   content.includes('style={')   → fooled by any "style=" in strings/comments
//   content.match(/\d{2,4}px/g)    → matched line numbers in error messages,
//                                    comments, anything resembling 2-4 digits + 'px'
//
// JSX makes style attributes first-class AST nodes; CSS-in-JS template
// literals are also parseable. We walk JSX to count REAL inline styles
// and inspect their string content for hardcoded values.

import * as t from '@babel/types';
import type { File } from '@babel/types';
import { walk } from './visitors.js';

export interface VisualSignalHit {
  filePath: string;
  line: number;
  kind: 'inline-style' | 'hardcoded-px-in-style' | 'inline-color-literal';
  preview: string;
}

export interface VisualSignals {
  inlineStyleAttrs: VisualSignalHit[];
  hardcodedPxInStyles: VisualSignalHit[];
  inlineColorLiterals: VisualSignalHit[];
}

const PX_NUMBER_RE = /(\d{2,4})px\b/g;
const COLOR_LITERAL_RE = /#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\b/i;

export function findVisualSignals(filePath: string, ast: File): VisualSignals {
  const out: VisualSignals = {
    inlineStyleAttrs: [],
    hardcodedPxInStyles: [],
    inlineColorLiterals: [],
  };

  walk(ast, (node) => {
    if (!t.isJSXAttribute(node)) return true;
    if (!t.isJSXIdentifier(node.name) || node.name.name !== 'style') return true;
    if (!node.value) return true;

    const line = node.loc?.start.line ?? 1;

    // <div style={{ ... }}>: ExpressionContainer wrapping an ObjectExpression
    if (t.isJSXExpressionContainer(node.value) && t.isObjectExpression(node.value.expression)) {
      out.inlineStyleAttrs.push({
        filePath, line, kind: 'inline-style',
        preview: 'style={{ … }}',
      });
      // Inspect each property value for hardcoded px / color literals.
      for (const prop of node.value.expression.properties) {
        if (!t.isObjectProperty(prop)) continue;
        const v = prop.value;
        if (t.isStringLiteral(v)) {
          checkValueString(v.value, filePath, line, out);
        } else if (t.isTemplateLiteral(v) && v.quasis.length === 1) {
          checkValueString(v.quasis[0].value.cooked ?? '', filePath, line, out);
        }
      }
    }
    // <div style="...">: plain string attribute (rare in JSX but valid for HTML)
    else if (t.isStringLiteral(node.value)) {
      out.inlineStyleAttrs.push({
        filePath, line, kind: 'inline-style',
        preview: `style="${node.value.value.slice(0, 60)}…"`,
      });
      checkValueString(node.value.value, filePath, line, out);
    }
    return true;
  });

  return out;
}

function checkValueString(s: string, filePath: string, line: number, out: VisualSignals): void {
  // Hardcoded pixel values like "16px", "1024px"
  let m: RegExpExecArray | null;
  PX_NUMBER_RE.lastIndex = 0;
  while ((m = PX_NUMBER_RE.exec(s)) !== null) {
    out.hardcodedPxInStyles.push({
      filePath, line, kind: 'hardcoded-px-in-style',
      preview: m[0],
    });
  }
  // Inline color hex (#abc, #abcdef, #abcdef00)
  const colorMatch = COLOR_LITERAL_RE.exec(s);
  if (colorMatch) {
    out.inlineColorLiterals.push({
      filePath, line, kind: 'inline-color-literal',
      preview: colorMatch[0],
    });
  }
}
