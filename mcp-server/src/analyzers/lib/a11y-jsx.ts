// AST-based accessibility checks for JSX/TSX.
//
// The line-level regex version of the accessibility analyzer:
//   - missed any `<img>` with the alt attribute on a different line
//     (`<img\n  alt="..."\n  src=...\n/>`)
//   - over-flagged any line with `<img` but no `alt=` even when the
//     attribute was just below
//   - couldn't see whether `aria-label` was a non-empty string
//
// JSX attributes are first-class AST nodes. This module walks
// JSXOpeningElement nodes and runs proper attribute-aware checks:
//
//   img.alt:              must be present (even alt="" is valid for
//                          decorative images, so we just check existence)
//   button content:       must have children or aria-label / aria-labelledby
//   anchor content:       same, plus rel="noopener" check on target=_blank
//   input / select /
//   textarea:             must have aria-label or aria-labelledby OR an
//                          id paired with a <label for=...> elsewhere
//                          (id-pairing requires file-scope analysis;
//                          we report when nothing inline is present)
//   div with onClick      must have role + tabIndex + key handler
//
// All checks return rich findings with the JSX element's source
// location so the user can jump to it in their IDE.

import * as t from '@babel/types';
import type { File } from '@babel/types';
import { walk } from './visitors.js';

export interface A11yJsxFinding {
  rule:
    | 'img-no-alt'
    | 'button-no-accessible-name'
    | 'anchor-no-accessible-name'
    | 'anchor-target-blank-no-noopener'
    | 'input-no-label'
    | 'clickable-non-interactive'
    | 'aria-empty';
  severity: 'high' | 'medium' | 'low';
  title: string;
  filePath: string;
  line: number;
  column: number;
  element: string;
  wcagCriterion: string;
  fix: string;
}

/** Public entry — return all findings for a single JSX/TSX file. */
export function checkJsxAccessibility(filePath: string, ast: File): A11yJsxFinding[] {
  const out: A11yJsxFinding[] = [];

  // Pre-pass: collect every `<label htmlFor="x">` / `<label for="x">` target in
  // the file. An <input id="x"> paired with such a label IS labelled — this is
  // the canonical accessible pattern. Without this the analyzer false-positives
  // on every correctly-labelled form (the inline check only sees aria-label).
  const labelFor = new Set<string>();
  walk(ast, (node) => {
    if (t.isJSXElement(node) && jsxElementName(node.openingElement) === 'label') {
      const target =
        getStringAttributeValue(node.openingElement, 'htmlFor') ??
        getStringAttributeValue(node.openingElement, 'for');
      if (target) labelFor.add(target);
    }
    return true;
  });

  walk(ast, (parentNode) => {
    // We need the JSXElement (parent of the opening element) so we can
    // see children. JSXFragment also has children but no name → skip.
    if (t.isJSXElement(parentNode)) {
      checkOne(parentNode.openingElement, parentNode.children, filePath, out, labelFor);
      return true;
    }
    // Self-closing elements also show up as JSXElement with selfClosing=true
    // and empty children, so the branch above catches them. But just in
    // case the walker visits a bare JSXOpeningElement (which can happen
    // depending on the AST), handle it:
    if (t.isJSXOpeningElement(parentNode)) {
      // If we already visited via the parent JSXElement, the children
      // path will have run too. Avoid double-firing by only handling
      // here if it's NOT inside a JSXElement we just visited. We can't
      // easily detect that without parent tracking, so we rely on the
      // dedup at the caller layer. In practice walk visits parents
      // first, so this branch rarely re-fires for the same node.
      const name = jsxElementName(parentNode);
      if (!name) return true;
    }
    return true;
  });

  // De-dup by (file, line, column, rule).
  const seen = new Set<string>();
  return out.filter((f) => {
    const k = `${f.line}|${f.column}|${f.rule}|${f.element}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function checkOne(
  node: t.JSXOpeningElement,
  children: t.JSXElement['children'],
  filePath: string,
  out: A11yJsxFinding[],
  labelFor: Set<string>
) {
  const name = jsxElementName(node);
  if (!name) return;

    const line = node.loc?.start.line ?? 1;
    const column = node.loc?.start.column ?? 0;

    // ── img / Image (Next.js)
    if (name === 'img' || name === 'Image') {
      if (!hasAttribute(node, 'alt')) {
        out.push({
          rule: 'img-no-alt',
          severity: 'high',
          title: '<img> without alt attribute',
          filePath, line, column,
          element: name,
          wcagCriterion: '1.1.1 — Non-text Content (Level A)',
          fix: 'Add `alt="…"` describing the image, or `alt=""` if it\'s purely decorative.',
        });
      }
    }

    // ── button
    if (name === 'button') {
      if (!hasAccessibleName(node, children)) {
        out.push({
          rule: 'button-no-accessible-name',
          severity: 'high',
          title: '<button> has no accessible name',
          filePath, line, column,
          element: name,
          wcagCriterion: '4.1.2 — Name, Role, Value (Level A)',
          fix: 'Add visible text inside the button, or `aria-label="action"` if the button shows an icon only.',
        });
      }
    }

    // ── anchor
    if (name === 'a') {
      if (!hasAccessibleName(node, children)) {
        out.push({
          rule: 'anchor-no-accessible-name',
          severity: 'high',
          title: '<a> has no accessible name',
          filePath, line, column,
          element: name,
          wcagCriterion: '2.4.4 — Link Purpose (Level A)',
          fix: 'Put descriptive text inside the link (“View pricing”, not “click here”), or use `aria-label`.',
        });
      }
      const target = getStringAttributeValue(node, 'target');
      if (target === '_blank') {
        const rel = getStringAttributeValue(node, 'rel') || '';
        if (!/\bnoopener\b/.test(rel) && !/\bnoreferrer\b/.test(rel)) {
          out.push({
            rule: 'anchor-target-blank-no-noopener',
            severity: 'medium',
            title: '<a target="_blank"> without rel="noopener"',
            filePath, line, column,
            element: name,
            wcagCriterion: 'Security/UX — tabnabbing risk',
            fix: 'Add `rel="noopener"` (or `rel="noopener noreferrer"`). The new tab gets `window.opener=null`, preventing it from navigating the parent tab.',
          });
        }
      }
    }

    // ── input / select / textarea
    if (name === 'input' || name === 'select' || name === 'textarea') {
      // Skip hidden / submit inputs — they don't need labels.
      const inputType = getStringAttributeValue(node, 'type');
      if (name === 'input' && (inputType === 'hidden' || inputType === 'submit' || inputType === 'button')) {
        return;
      }
      const ownId = getStringAttributeValue(node, 'id');
      const labelledByFor = ownId !== null && labelFor.has(ownId);
      if (!hasInlineLabelAssociation(node) && !labelledByFor) {
        out.push({
          rule: 'input-no-label',
          severity: 'medium',
          title: `<${name}> with no visible label association`,
          filePath, line, column,
          element: name,
          wcagCriterion: '3.3.2 — Labels or Instructions (Level A)',
          fix: 'Pair with a `<label htmlFor="…">`, or add `aria-label="…"` / `aria-labelledby="…"` for screen readers.',
        });
      }
    }

    // ── div / span with onClick but no role + tabIndex
    // `aria-hidden` elements are removed from the accessibility tree, so a
    // dismiss-backdrop / decorative overlay with a mouse-only onClick is not a
    // keyboard control — the real control lives elsewhere. Don't flag it.
    if (
      (name === 'div' || name === 'span') &&
      hasAttribute(node, 'onClick') &&
      !hasSpread(node) &&
      getStringAttributeValue(node, 'aria-hidden') !== 'true'
    ) {
      const role = getStringAttributeValue(node, 'role');
      const hasRole = hasAttribute(node, 'role');
      const hasTabIndex = hasAttribute(node, 'tabIndex');
      // A structural role (group/region/list/…) means the onClick is an
      // enhancement, not a custom control — keyboard focus lives on the
      // real interactive children, so don't demand tabIndex here.
      const structural = role !== null && NON_INTERACTIVE_ROLES.has(role);
      if (!structural && (!hasRole || !hasTabIndex)) {
        out.push({
          rule: 'clickable-non-interactive',
          severity: 'medium',
          title: `<${name} onClick> without role+tabIndex (not keyboard-accessible)`,
          filePath, line, column,
          element: name,
          wcagCriterion: '2.1.1 — Keyboard (Level A)',
          fix: 'Use `<button>` if it\'s a control. Otherwise add `role="button" tabIndex={0} onKeyDown={…}` to make it keyboard-reachable.',
        });
      }
    }

    // ── aria-label="" (empty string aria attribute is worse than nothing)
    for (const attr of node.attributes) {
      if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;
      const attrName = attr.name.name;
      if (attrName === 'aria-label' || attrName === 'aria-labelledby' || attrName === 'aria-describedby') {
        const value = getStringAttributeValueRaw(attr);
        if (value !== null && value.trim() === '') {
          out.push({
            rule: 'aria-empty',
            severity: 'medium',
            title: `${attrName}="" (empty string)`,
            filePath, line, column,
            element: name,
            wcagCriterion: '4.1.2 — Name, Role, Value (Level A)',
            fix: `Either populate ${attrName} with descriptive text, or remove the attribute entirely.`,
          });
        }
      }
    }

}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function jsxElementName(node: t.JSXOpeningElement): string | null {
  if (t.isJSXIdentifier(node.name)) return node.name.name;
  return null;
}

function hasAttribute(node: t.JSXOpeningElement, name: string): boolean {
  return node.attributes.some(
    (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === name
  );
}

/**
 * Does the element spread props (`{...props}` / `{...rest}`)? Design-system
 * primitives and wrapper components forward arbitrary props this way, so the
 * accessible name (children / aria-label) or a label association (id /
 * aria-label) may be supplied by the caller. We can't see that statically, so
 * a name/label check must NOT fire — otherwise every shadcn/MUI primitive
 * `<input {...props} />` produces a false positive.
 */
function hasSpread(node: t.JSXOpeningElement): boolean {
  return node.attributes.some((a) => t.isJSXSpreadAttribute(a));
}

// Structural / non-interactive ARIA roles. A div/span carrying one of these
// plus an onClick is a container with an enhancement handler (e.g. a group
// that forwards focus to its input), not a custom control — it doesn't need
// tabIndex/keyboard handling.
const NON_INTERACTIVE_ROLES = new Set([
  'group', 'presentation', 'none', 'region', 'list', 'listitem',
  'row', 'rowgroup', 'cell', 'gridcell', 'separator', 'toolbar',
  'tablist', 'document', 'article', 'banner', 'main', 'navigation',
]);

function getStringAttributeValue(node: t.JSXOpeningElement, name: string): string | null {
  for (const attr of node.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;
    if (attr.name.name !== name) continue;
    return getStringAttributeValueRaw(attr);
  }
  return null;
}

function getStringAttributeValueRaw(attr: t.JSXAttribute): string | null {
  if (t.isStringLiteral(attr.value)) return attr.value.value;
  if (
    t.isJSXExpressionContainer(attr.value) &&
    t.isStringLiteral(attr.value.expression)
  ) {
    return attr.value.expression.value;
  }
  if (
    t.isJSXExpressionContainer(attr.value) &&
    t.isTemplateLiteral(attr.value.expression) &&
    attr.value.expression.quasis.length === 1
  ) {
    return attr.value.expression.quasis[0].value.cooked ?? null;
  }
  // Non-literal expression — we can't statically resolve, so don't claim it's empty
  return null;
}

/**
 * Has an "accessible name"? Buttons/anchors get one from:
 *   - children that contain text (JSXText with non-whitespace, or an
 *     expression that's a string literal / template, or a recursive
 *     accessible-name-bearing child like a <span>label</span>)
 *   - aria-label (non-empty)
 *   - aria-labelledby
 *   - title (less ideal but counts)
 *   - dangerouslySetInnerHTML (assume populated)
 *
 * "Icon-only" buttons — children consisting only of a self-closing
 * `<svg />` (or any other element with no text) — return false.
 */
function hasAccessibleName(
  node: t.JSXOpeningElement,
  children: t.JSXElement['children']
): boolean {
  if (hasSpread(node)) return true; // name may arrive via {...props}
  if (hasAttribute(node, 'aria-label')) {
    const v = getStringAttributeValue(node, 'aria-label');
    if (v === null || v.trim() !== '') return true;
  }
  if (hasAttribute(node, 'aria-labelledby')) return true;
  if (hasAttribute(node, 'title')) return true;
  if (hasAttribute(node, 'dangerouslySetInnerHTML')) return true;

  if (node.selfClosing) return false;

  return childrenHaveAccessibleText(children);
}

function childrenHaveAccessibleText(children: t.JSXElement['children']): boolean {
  for (const child of children) {
    if (t.isJSXText(child)) {
      if (child.value.trim() !== '') return true;
    } else if (t.isJSXExpressionContainer(child)) {
      // {`Hello`}, {label}, {cond ? 'a' : 'b'}, {loading && 'Saving'} …
      if (expressionHasAccessibleText(child.expression)) return true;
    } else if (t.isJSXElement(child)) {
      // Recurse — child element might carry text or its own aria-label.
      if (
        hasAttribute(child.openingElement, 'aria-label') ||
        hasAttribute(child.openingElement, 'aria-labelledby') ||
        hasAttribute(child.openingElement, 'title')
      ) return true;
      if (childrenHaveAccessibleText(child.children)) return true;
    } else if (t.isJSXFragment(child)) {
      if (childrenHaveAccessibleText(child.children)) return true;
    }
  }
  return false;
}

/**
 * Does a JSX expression `{…}` render accessible text? Handles the shapes a
 * button label actually takes: string/template literals, identifiers/calls
 * (can't prove empty → accept), conditionals (`{loading ? 'Saving' : 'Save'}`),
 * `&&` guards (`{count && \`(${count})\`}`), `+` concatenation, and nested
 * JSX. An icon-only conditional like `{open ? <X/> : <Menu/>}` yields false in
 * both branches and is still — correctly — flagged.
 */
function expressionHasAccessibleText(
  e: t.Expression | t.JSXEmptyExpression
): boolean {
  if (t.isJSXEmptyExpression(e)) return false;
  if (t.isStringLiteral(e)) return e.value.trim() !== '';
  if (t.isTemplateLiteral(e)) {
    const joined = e.quasis.map((q) => q.value.cooked ?? '').join('');
    if (joined.trim() !== '') return true;
    return e.expressions.length > 0; // `${dynamic}` — can't prove empty
  }
  if (t.isIdentifier(e) || t.isMemberExpression(e) || t.isCallExpression(e)) {
    return true; // dynamic — assume it may render text (avoid false positives)
  }
  if (t.isConditionalExpression(e)) {
    return (
      expressionHasAccessibleText(e.consequent) ||
      expressionHasAccessibleText(e.alternate)
    );
  }
  if (t.isLogicalExpression(e)) {
    // `a && b` → only the right operand renders; `a || b` / `a ?? b` → either.
    if (e.operator === '&&') return expressionHasAccessibleText(e.right);
    return (
      expressionHasAccessibleText(e.left) ||
      expressionHasAccessibleText(e.right)
    );
  }
  if (t.isBinaryExpression(e) && e.operator === '+') {
    const leftHasText = t.isExpression(e.left)
      ? expressionHasAccessibleText(e.left)
      : false;
    return leftHasText || expressionHasAccessibleText(e.right);
  }
  if (t.isJSXElement(e)) {
    if (
      hasAttribute(e.openingElement, 'aria-label') ||
      hasAttribute(e.openingElement, 'aria-labelledby') ||
      hasAttribute(e.openingElement, 'title')
    )
      return true;
    return childrenHaveAccessibleText(e.children);
  }
  if (t.isJSXFragment(e)) return childrenHaveAccessibleText(e.children);
  // Unknown expression type — be conservative and don't flag (a real
  // icon-only button renders the icon directly as a child, not via `{…}`).
  return true;
}

function hasInlineLabelAssociation(node: t.JSXOpeningElement): boolean {
  if (hasSpread(node)) return true; // id / aria-label may arrive via {...props}
  if (hasAttribute(node, 'aria-label')) {
    const v = getStringAttributeValue(node, 'aria-label');
    if (v === null || v.trim() !== '') return true;
  }
  if (hasAttribute(node, 'aria-labelledby')) return true;
  if (hasAttribute(node, 'placeholder')) {
    // Placeholder isn't a real label per WCAG, but its presence
    // means the form was at least considered — drop the severity.
    // We still return false so this fires, just at medium not high.
    // (Severity adjustment happens at the caller's discretion.)
  }
  return false;
}
