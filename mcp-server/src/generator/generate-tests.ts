// Given a static-analysis finding, ask the model to produce ONE self-contained
// test that exercises the failure mode. Polyglot since v0.29.0: the test is
// generated in the language of the file the finding came from —
//   .py            → pytest
//   .go            → go test
//   .ts/.js/.tsx…  → Vitest (the original path)
// and the runner (docker-runner) executes it in the matching sandbox image.
//
// Tests are pattern-level + self-contained (recreate the foot-gun against
// synthetic inputs); they do NOT import the project under test.
import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter, PRIMARY_MODEL, FALLBACK_MODEL, ProviderAttempt } from './llm-client.js';

export type TestLanguage = 'js' | 'python' | 'go';

export interface InputFinding {
  rule: string;
  title: string;
  description: string;
  filePath: string;
  lineNumber: number;
  fixSuggestion: string;
  severity: string;
}

/** Map a finding's source file to the test language we should generate. */
export function detectLanguage(filePath: string | undefined | null): TestLanguage {
  // Some findings have no file (supply-chain, license, project-level k8s like
  // "No NetworkPolicy"). Default to JS/TS rather than crashing on undefined.
  const f = (filePath ?? '').toLowerCase();
  if (f.endsWith('.py')) return 'python';
  if (f.endsWith('.go')) return 'go';
  return 'js';
}

interface LangConfig {
  /** Stored on the result + used by the runner to pick the sandbox image. */
  language: TestLanguage;
  /** Required filename suffix (also how the runner groups files). */
  ext: '.test.ts' | '_test.py' | '_test.go';
  filenameDesc: string;
  contentDesc: string;
  system: string;
}

const LANGS: Record<TestLanguage, LangConfig> = {
  js: {
    language: 'js',
    ext: '.test.ts',
    filenameDesc:
      'Test filename ending in .test.ts, kebab-case, slugged from the rule + line (e.g. parseInt-no-radix-l142.test.ts).',
    contentDesc:
      'Full Vitest test file source. Must `import { describe, it, expect } from "vitest"`. ≥2 it() blocks: one demonstrating the foot-gun, one asserting the safe fix.',
    system: `You are a senior test author writing Vitest tests for JavaScript/TypeScript.
You get ONE static-analysis finding describing a production-risk pattern.
Output ONE Vitest file as JSON: { filename, content, reasoning }.
Hard requirements for content:
- \`import { describe, it, expect } from "vitest"\`
- Self-contained: do NOT import the project under test — recreate the foot-gun with local synthetic inputs.
- ≥2 it() blocks: one demonstrates the failure mode, one asserts the suggested fix.
- No network, no fs writes, no Date.now()/setTimeout flakiness.
- filename: kebab-case, ends in .test.ts`,
  },
  python: {
    language: 'python',
    ext: '_test.py',
    filenameDesc:
      'Test filename ending in _test.py, snake_case, slugged from the rule + line (e.g. sql_injection_l52_test.py).',
    contentDesc:
      'Full pytest file source. Top-level `def test_…` functions only (no classes needed). ≥2 test functions: one demonstrating the foot-gun, one asserting the safe fix. Use plain `assert`.',
    system: `You are a senior test author writing pytest tests for Python.
You get ONE static-analysis finding describing a production-risk pattern.
Output ONE pytest file as JSON: { filename, content, reasoning }.
Hard requirements for content:
- Use plain pytest: top-level \`def test_xxx():\` functions with \`assert\`. \`import pytest\` only if you use it.
- Self-contained: do NOT import the project under test — recreate the foot-gun with local synthetic inputs (define small helper functions inline).
- ≥2 test functions: one demonstrates the failure mode, one asserts the suggested fix.
- No network, no file writes, no time-based flakiness.
- filename: snake_case, ends in _test.py`,
  },
  go: {
    language: 'go',
    ext: '_test.go',
    filenameDesc:
      'Test filename ending in _test.go, snake_case, slugged from the rule + line (e.g. path_traversal_l31_test.go).',
    contentDesc:
      'Full Go test file source. MUST start with `package main`. ≥2 `func TestXxx(t *testing.T)` functions: one demonstrating the foot-gun, one asserting the safe fix. Use `t.Errorf`/`t.Fatalf`.',
    system: `You are a senior test author writing Go tests (stdlib testing).
You get ONE static-analysis finding describing a production-risk pattern.
Output ONE Go test file as JSON: { filename, content, reasoning }.
Hard requirements for content:
- The file MUST declare \`package main\` and \`import "testing"\` (plus only stdlib packages you actually use).
- Self-contained: do NOT import the project under test — recreate the foot-gun with local synthetic inputs (define small helper funcs inline in the same file).
- ≥2 \`func TestXxx(t *testing.T)\` functions: one demonstrates the failure mode, one asserts the suggested fix. Use t.Errorf / t.Fatalf.
- No network, no file writes, no time-based flakiness.
- filename: snake_case, ends in _test.go`,
  },
};

function schemaFor(cfg: LangConfig) {
  return z.object({
    filename: z.string().describe(cfg.filenameDesc),
    content: z.string().describe(cfg.contentDesc),
    reasoning: z.string().describe('One short sentence explaining what the test exercises.'),
  });
}

export interface GeneratedTestFile {
  filename: string;
  content: string;
  reasoning: string;
  /** Which sandbox the runner should execute this in. */
  language: TestLanguage;
}

/**
 * Build a deterministic, collision-free filename for a finding's test.
 *
 * The model is asked to slug the name from "rule + line", but in practice it
 * routinely drops the line — so N findings of the same rule (e.g. eight
 * `new-date-on-string`) all land on one filename and overwrite each other in
 * the run dir, silently dropping most of the tests. We derive the name
 * ourselves from rule + source-file + line so every finding gets its own file.
 * Language conventions: js → kebab-case + .test.ts; python/go → snake_case +
 * _test.{py,go}.
 */
export function uniqueTestFilename(finding: InputFinding, cfg: Pick<LangConfig, 'language' | 'ext'>, llmName?: string): string {
  const sep = cfg.language === 'js' ? '-' : '_';
  const ruleSlug = (finding.rule || llmName || finding.title || 'test')
    .replace(/\.test\.tsx?$/i, '')
    .replace(/_test\.(py|go)$/i, '');
  const src = ((finding.filePath ?? '').split(/[/\\]/).pop() || 'src').replace(/\.[^.]+$/, '');
  const line = Number.isFinite(Number(finding.lineNumber)) ? Number(finding.lineNumber) : 0;
  const escSep = sep === '-' ? '\\-' : sep;
  const slug = `${ruleSlug}${sep}${src}${sep}l${line}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, sep)
    .replace(new RegExp(`^${escSep}+|${escSep}+$`, 'g'), '') || 'test';
  return slug + cfg.ext;
}

export interface GenerateResult {
  finding: InputFinding;
  file: GeneratedTestFile | null;
  attempts: ProviderAttempt[];
}

async function generateOne(
  finding: InputFinding,
  cfg: LangConfig,
  model: string,
  attempts: ProviderAttempt[]
): Promise<GeneratedTestFile | null> {
  const started = Date.now();
  try {
    const { object } = await generateObject({
      // AI SDK v6: .chat(model) for OpenAI-compatible providers (OpenRouter).
      model: openrouter.chat(model),
      schema: schemaFor(cfg),
      system: cfg.system,
      prompt: `Finding: ${finding.title}
Rule: ${finding.rule || finding.title}
Severity: ${finding.severity}
File: ${finding.filePath}:${finding.lineNumber}
Description: ${finding.description}
Suggested fix: ${finding.fixSuggestion}

Write the ${cfg.language === 'js' ? 'Vitest' : cfg.language === 'python' ? 'pytest' : 'Go test'} file.`,
      temperature: 0.2,
      maxRetries: 1,
    });
    attempts.push({ model, ok: true, durationMs: Date.now() - started });
    // Override the model-chosen filename with a deterministic, unique one so
    // same-rule findings can't overwrite each other in the run dir.
    return { ...object, filename: uniqueTestFilename(finding, cfg, object.filename), language: cfg.language };
  } catch (err) {
    attempts.push({ model, ok: false, error: (err as Error).message, durationMs: Date.now() - started });
    return null;
  }
}

export async function generateTestForFinding(finding: InputFinding): Promise<GenerateResult> {
  const attempts: ProviderAttempt[] = [];
  const cfg = LANGS[detectLanguage(finding.filePath)];
  let file = await generateOne(finding, cfg, PRIMARY_MODEL, attempts);
  if (!file) {
    // Provider rotation — Kimi often succeeds when DeepSeek rate-limits.
    file = await generateOne(finding, cfg, FALLBACK_MODEL, attempts);
  }
  return { finding, file, attempts };
}

export async function generateTestsForFindings(
  findings: InputFinding[],
  maxFindings = 3
): Promise<GenerateResult[]> {
  const subset = findings.slice(0, maxFindings);
  return Promise.all(subset.map(generateTestForFinding));
}
