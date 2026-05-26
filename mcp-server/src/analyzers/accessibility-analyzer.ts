import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import { parseFile, isParseable } from './lib/parse.js';
import { checkJsxAccessibility } from './lib/a11y-jsx.js';

export interface A11yFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  filePath: string;
  lineNumber: number;
  codeSnippet: string;
  fixSuggestion: string;
  wcagCriterion: string;
}

export interface A11yReport {
  findings: A11yFinding[];
  imagesWithoutAlt: number;
  formsWithoutLabels: number;
  missingAriaCount: number;
  totalHtmlFiles: number;
  score: number; // 0-100
}

/**
 * Run accessibility analysis on HTML templates and JSX/TSX files.
 * Checks for common WCAG 2.1 Level AA violations.
 */
export async function runAccessibilityAnalysis(config: {
  projectPath: string;
  fileContents?: Record<string, string>;
}): Promise<A11yReport> {
  const { projectPath } = config;

  if (!existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }

  let fileContents = config.fileContents;
  if (!fileContents || Object.keys(fileContents).length === 0) {
    fileContents = {};
    const patterns = [
      '**/*.{html,tsx,jsx,vue,svelte}',
      '!**/node_modules/**',
      '!**/.git/**',
      '!**/dist/**',
      '!**/build/**',
    ];
    const files = await glob(patterns, { cwd: projectPath, absolute: false });
    for (const f of files) {
      try {
        fileContents[f] = readFileSync(join(projectPath, f), 'utf-8');
      } catch { /* skip */ }
    }
  }

  const findings: A11yFinding[] = [];
  let imagesWithoutAlt = 0;
  let formsWithoutLabels = 0;
  let missingAriaCount = 0;
  const htmlFiles = Object.keys(fileContents).filter(f => f.endsWith('.html') || f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.vue') || f.endsWith('.svelte'));

  for (const [filePath, content] of Object.entries(fileContents)) {
    if (filePath.includes('node_modules')) continue;
    const lines = content.split('\n');

    // AST-based JSX/TSX checks (pass 5). Replaces several line-level
    // regex checks below for the JSX case. HTML/Vue/Svelte still go
    // through the regex helpers since Babel doesn't parse them.
    if ((filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) && isParseable(filePath)) {
      const parsed = parseFile(filePath, content);
      if (parsed.ast) {
        const jsxHits = checkJsxAccessibility(filePath, parsed.ast);
        for (const hit of jsxHits) {
          const snippet = (lines[hit.line - 1] || '').trim().slice(0, 140);
          findings.push({
            severity: hit.severity,
            title: hit.title,
            description: `${hit.element} at ${filePath}:${hit.line}. Rule: ${hit.rule}.`,
            filePath,
            lineNumber: hit.line,
            codeSnippet: snippet,
            fixSuggestion: hit.fix,
            wcagCriterion: hit.wcagCriterion,
          });
          if (hit.rule === 'img-no-alt') imagesWithoutAlt++;
          if (hit.rule === 'input-no-label') formsWithoutLabels++;
          if (hit.rule === 'aria-empty' || hit.rule === 'clickable-non-interactive') missingAriaCount++;
        }
        // For JSX files we trust the AST results — skip the
        // duplicate regex checks below to avoid double-counting.
        // Still run a few project-shape checks (heading hierarchy,
        // contrast, semantic) since those look at content patterns
        // the AST doesn't reify cleanly.
        checkHeadingHierarchy(lines, filePath, findings);
        checkColorContrast(lines, filePath, findings);
        checkSemanticHtml(lines, filePath, findings);
        continue;
      }
    }

    // ── Non-JSX path (HTML, Vue, Svelte, parse-failed JSX) ──
    // 1. Images without alt text
    checkImagesWithoutAlt(lines, filePath, findings, () => { imagesWithoutAlt++; });

    // 2. Forms without labels
    checkFormsWithoutLabels(lines, filePath, findings, () => { formsWithoutLabels++; });

    // 3. Missing ARIA attributes on interactive elements
    checkMissingAria(lines, filePath, findings, () => { missingAriaCount++; });

    // 4. Heading hierarchy
    checkHeadingHierarchy(lines, filePath, findings);

    // 5. Color/contrast indicators
    checkColorContrast(lines, filePath, findings);

    // 6. Focus management
    checkFocusManagement(lines, filePath, findings);

    // 7. Semantic HTML
    checkSemanticHtml(lines, filePath, findings);

    // 8. Link text
    checkLinkText(lines, filePath, findings);
  }

  // Calculate score (0-100)
  const totalIssues = findings.length;
  let score = Math.max(0, 100 - totalIssues * 3);
  if (score < 0) score = 0;

  // Bonus for having some a11y-conscious patterns
  const hasA11yPatterns = Object.values(fileContents).some(c =>
    c.includes('aria-') || c.includes('role=') || c.includes('sr-only') || c.includes('screen reader')
  );
  if (hasA11yPatterns) score = Math.min(100, score + 10);

  return {
    findings,
    imagesWithoutAlt,
    formsWithoutLabels,
    missingAriaCount,
    totalHtmlFiles: htmlFiles.length,
    score,
  };
}

/* -------------------------------------------------------------------------- */
/*                              Check Functions                               */
/* -------------------------------------------------------------------------- */

function checkImagesWithoutAlt(
  lines: string[],
  filePath: string,
  findings: A11yFinding[],
  incrementCounter: () => void
) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check JSX img without alt
    if (line.includes('<img') && !line.includes('alt=') && !line.includes('{...')) {
      findings.push({
        severity: 'high',
        title: 'Image Missing Alt Text',
        description: '<img> element does not have an alt attribute. Screen readers cannot describe the image to visually impaired users.',
        filePath,
        lineNumber: i + 1,
        codeSnippet: line.trim().slice(0, 120),
        fixSuggestion: 'Add an alt attribute describing the image. Use alt="" for decorative images.',
        wcagCriterion: 'WCAG 1.1.1 (Non-text Content)',
      });
      incrementCounter();
    }

    // Check Next.js Image without alt
    if (line.includes('<Image') && !line.includes('alt=') && !line.includes('{...')) {
      findings.push({
        severity: 'high',
        title: 'Next.js Image Missing Alt Text',
        description: 'Next.js Image component does not have an alt prop.',
        filePath,
        lineNumber: i + 1,
        codeSnippet: line.trim().slice(0, 120),
        fixSuggestion: 'Add alt prop to the Image component describing the image.',
        wcagCriterion: 'WCAG 1.1.1 (Non-text Content)',
      });
      incrementCounter();
    }

    // Check empty alt
    if (line.includes('<img') && line.includes('alt=""') && !line.includes('role="presentation"') && !line.includes('aria-hidden')) {
      findings.push({
        severity: 'low',
        title: 'Empty Alt Without Decorative Role',
        description: 'Image has empty alt but no explicit decorative role. Screen readers may ignore it but semantics are unclear.',
        filePath,
        lineNumber: i + 1,
        codeSnippet: line.trim().slice(0, 120),
        fixSuggestion: 'Add role="presentation" or aria-hidden="true" if the image is decorative. If it conveys meaning, add descriptive alt text.',
        wcagCriterion: 'WCAG 1.1.1 (Non-text Content)',
      });
    }
  }
}

function checkFormsWithoutLabels(
  lines: string[],
  filePath: string,
  findings: A11yFinding[],
  incrementCounter: () => void
) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Input without associated label
    if ((line.includes('<input') || line.includes('<textarea') || line.includes('<select')) &&
        !line.includes('aria-label') && !line.includes('aria-labelledby') &&
        !line.includes('placeholder') && !line.includes('hidden') &&
        !line.includes('type="hidden"') && !line.includes('type="button"') &&
        !line.includes('type="submit"') && !line.includes('type="reset"')) {

      findings.push({
        severity: 'high',
        title: 'Form Input Without Label',
        description: 'Form input lacks an associated label. Screen readers cannot identify the purpose of the input.',
        filePath,
        lineNumber: i + 1,
        codeSnippet: line.trim().slice(0, 120),
        fixSuggestion: 'Wrap the input in a <label> element, or use htmlFor/id association, or add aria-label/aria-labelledby.',
        wcagCriterion: 'WCAG 3.3.2 (Labels or Instructions)',
      });
      incrementCounter();
    }
  }
}

function checkMissingAria(
  lines: string[],
  filePath: string,
  findings: A11yFinding[],
  incrementCounter: () => void
) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Buttons without role or type
    if (line.includes('onClick') && line.includes('div') && !line.includes('role=')) {
      findings.push({
        severity: 'medium',
        title: 'Clickable Div Without Role',
        description: 'A div element has an onClick handler but no role attribute. Screen readers do not announce it as interactive.',
        filePath,
        lineNumber: i + 1,
        codeSnippet: line.trim().slice(0, 120),
        fixSuggestion: 'Add role="button" and tabindex="0". Better yet, use a native <button> element.',
        wcagCriterion: 'WCAG 4.1.2 (Name, Role, Value)',
      });
      incrementCounter();
    }

    // Interactive elements without aria-label
    if ((line.includes('role="button"') || line.includes('role="link"')) &&
        !line.includes('aria-label') && !line.includes('aria-labelledby')) {
      findings.push({
        severity: 'medium',
        title: 'Interactive Element Without Accessible Name',
        description: 'An element with a button/link role has no accessible name.',
        filePath,
        lineNumber: i + 1,
        codeSnippet: line.trim().slice(0, 120),
        fixSuggestion: 'Add aria-label or ensure the element has visible text content that serves as its label.',
        wcagCriterion: 'WCAG 4.1.2 (Name, Role, Value)',
      });
      incrementCounter();
    }

    // Missing aria-live for dynamic content
    if ((line.includes('setState') || line.includes('useState') || line.includes('loading')) &&
        line.includes('&&') && !line.includes('aria-live') && !line.includes('aria-busy')) {
      // This is a loose heuristic for React conditional rendering
      if (line.includes('loading') || line.includes('spinner') || line.includes('Skeleton')) {
        findings.push({
          severity: 'low',
          title: 'Dynamic Loading State Without ARIA',
          description: 'Loading state changes without aria-live region. Screen readers may not announce the change.',
          filePath,
          lineNumber: i + 1,
          codeSnippet: line.trim().slice(0, 120),
          fixSuggestion: 'Wrap dynamic content in a container with aria-live="polite" so screen readers announce changes.',
          wcagCriterion: 'WCAG 4.1.3 (Status Messages)',
        });
      }
    }
  }
}

function checkHeadingHierarchy(
  lines: string[],
  filePath: string,
  findings: A11yFinding[]
) {
  const headings: Array<{ level: number; lineNumber: number; snippet: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // HTML headings
    const htmlMatch = line.match(/<h([1-6])[^>]*>/);
    if (htmlMatch) {
      headings.push({ level: parseInt(htmlMatch[1]), lineNumber: i + 1, snippet: line.trim().slice(0, 80) });
    }

    // JSX/TSX typography components (common pattern)
    const jsxMatch = line.match(/<(?:Typography|Text)[^>]*variant\s*=\s*['"](h[1-6])['"]/);
    if (jsxMatch) {
      headings.push({ level: parseInt(jsxMatch[1][1]), lineNumber: i + 1, snippet: line.trim().slice(0, 80) });
    }
  }

  // Check hierarchy
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1];
    const curr = headings[i];
    if (curr.level > prev.level + 1) {
      findings.push({
        severity: 'medium',
        title: 'Skipped Heading Level',
        description: `Heading level jumps from h${prev.level} to h${curr.level}. Headings should not skip levels.`,
        filePath,
        lineNumber: curr.lineNumber,
        codeSnippet: curr.snippet,
        fixSuggestion: `Use h${prev.level + 1} instead of h${curr.level}, or restructure the document outline.`,
        wcagCriterion: 'WCAG 1.3.1 (Info and Relationships)',
      });
    }
  }
}

function checkColorContrast(
  lines: string[],
  filePath: string,
  findings: A11yFinding[]
) {
  const colorPatterns = [
    { regex: /color\s*:\s*['"]?(#[a-fA-F0-9]{3,6}|lightgray|lightgrey|#ddd|#ccc|#bbb|#aaa)['"]?/, severity: 'medium' as const, title: 'Potentially Low Contrast Text Color', desc: 'Light text colors may not meet WCAG AA contrast ratio (4.5:1 for normal text).' },
    { regex: /background(?:-color)?\s*:\s*['"]?(transparent|none)['"]?/, severity: 'low' as const, title: 'Transparent Background', desc: 'Transparent backgrounds may cause readability issues depending on the container.' },
    { regex: /text-gray-[3-5]00/, severity: 'medium' as const, title: 'Low Contrast Tailwind Text', desc: 'Tailwind gray-300 to gray-500 may not provide sufficient contrast on white backgrounds.' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const p of colorPatterns) {
      if (p.regex.test(line)) {
        findings.push({
          severity: p.severity,
          title: p.title,
          description: p.desc,
          filePath,
          lineNumber: i + 1,
          codeSnippet: line.trim().slice(0, 120),
          fixSuggestion: 'Use a contrast checking tool (WebAIM Contrast Checker). Aim for 4.5:1 for normal text, 3:1 for large text.',
          wcagCriterion: 'WCAG 1.4.3 (Contrast Minimum)',
        });
      }
    }
  }
}

function checkFocusManagement(
  lines: string[],
  filePath: string,
  findings: A11yFinding[]
) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // outline: none without focus styles
    if (line.includes('outline') && line.includes('none') && !line.includes('focus') && !line.includes(':focus-visible')) {
      findings.push({
        severity: 'medium',
        title: 'Focus Indicator Removed',
        description: 'CSS removes outline without providing an alternative focus indicator.',
        filePath,
        lineNumber: i + 1,
        codeSnippet: line.trim().slice(0, 120),
        fixSuggestion: 'Never remove focus indicators without replacement. Use :focus-visible with an alternative style (box-shadow, border).',
        wcagCriterion: 'WCAG 2.4.7 (Focus Visible)',
      });
    }

    // tabindex > 0
    if (line.includes('tabindex') && line.match(/tabindex\s*=\s*['"][1-9]['"]/)) {
      findings.push({
        severity: 'medium',
        title: 'Positive Tabindex',
        description: 'Positive tabindex values disrupt the natural tab order and confuse keyboard users.',
        filePath,
        lineNumber: i + 1,
        codeSnippet: line.trim().slice(0, 120),
        fixSuggestion: 'Use tabindex="0" for elements that should be focusable, or use native interactive elements. Avoid positive tabindex values.',
        wcagCriterion: 'WCAG 2.4.3 (Focus Order)',
      });
    }

    // onKeyDown missing while onClick present on non-interactive element
    if (line.includes('onClick') && line.includes('div') && !line.includes('onKeyDown') && !line.includes('onKeyPress')) {
      findings.push({
        severity: 'medium',
        title: 'Keyboard Accessibility Missing',
        description: 'Clickable div without keyboard handler. Keyboard-only users cannot activate this element.',
        filePath,
        lineNumber: i + 1,
        codeSnippet: line.trim().slice(0, 120),
        fixSuggestion: 'Add onKeyDown handler that responds to Enter/Space keys, or use a native <button> element.',
        wcagCriterion: 'WCAG 2.1.1 (Keyboard)',
      });
    }
  }
}

function checkSemanticHtml(
  lines: string[],
  filePath: string,
  findings: A11yFinding[]
) {
  // Check for common semantic HTML issues
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // <div> or <span> used for navigation
    if (line.includes('role="navigation"') && (line.includes('<div') || line.includes('<span'))) {
      findings.push({
        severity: 'low',
        title: 'Semantic HTML Alternative Available',
        description: '<nav> element should be used instead of div with navigation role.',
        filePath,
        lineNumber: i + 1,
        codeSnippet: line.trim().slice(0, 120),
        fixSuggestion: 'Replace <div role="navigation"> with the <nav> element for better semantic structure.',
        wcagCriterion: 'WCAG 1.3.1 (Info and Relationships)',
      });
    }

    // <div> or <span> used as main
    if (line.includes('role="main"') && (line.includes('<div') || line.includes('<span'))) {
      findings.push({
        severity: 'low',
        title: 'Semantic HTML Alternative Available',
        description: '<main> element should be used instead of div with main role.',
        filePath,
        lineNumber: i + 1,
        codeSnippet: line.trim().slice(0, 120),
        fixSuggestion: 'Replace <div role="main"> with the <main> element.',
        wcagCriterion: 'WCAG 1.3.1 (Info and Relationships)',
      });
    }

    // Tables without headers
    if (line.includes('<table') && !line.includes('<th') && !line.includes('role="presentation"')) {
      findings.push({
        severity: 'medium',
        title: 'Table Without Headers',
        description: 'Data table does not have <th> header cells. Screen readers cannot associate data cells with headers.',
        filePath,
        lineNumber: i + 1,
        codeSnippet: line.trim().slice(0, 120),
        fixSuggestion: 'Add <th> elements with scope="col" or scope="row". For layout tables, use role="presentation".',
        wcagCriterion: 'WCAG 1.3.1 (Info and Relationships)',
      });
    }

    // Missing lang attribute on <html>
    if (line.includes('<html') && !line.includes('lang=')) {
      findings.push({
        severity: 'low',
        title: 'Missing Language Attribute',
        description: '<html> element lacks a lang attribute. Screen readers may use incorrect pronunciation.',
        filePath,
        lineNumber: i + 1,
        codeSnippet: line.trim().slice(0, 120),
        fixSuggestion: 'Add lang="en" (or appropriate language code) to the <html> element.',
        wcagCriterion: 'WCAG 3.1.1 (Language of Page)',
      });
    }
  }
}

function checkLinkText(
  lines: string[],
  filePath: string,
  findings: A11yFinding[]
) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Links with no text or generic text
    if (line.includes('<a') || line.includes('<Link')) {
      const hasText = line.includes('>') && !line.includes('></a>') && !line.includes('/>');
      const hasGenericText = />(click here|read more|learn more|here|link|more)</i.test(line);

      if (!hasText || hasGenericText) {
        findings.push({
          severity: 'medium',
          title: hasGenericText ? 'Generic Link Text' : 'Empty Link',
          description: hasGenericText
            ? 'Link text like "click here" or "read more" is not descriptive for screen reader users.'
            : 'Link element appears to have no visible text content.',
          filePath,
          lineNumber: i + 1,
          codeSnippet: line.trim().slice(0, 120),
          fixSuggestion: 'Use descriptive link text that makes sense out of context. E.g., "Read the accessibility guidelines" instead of "click here".',
          wcagCriterion: 'WCAG 2.4.4 (Link Purpose In Context)',
        });
      }
    }
  }
}
