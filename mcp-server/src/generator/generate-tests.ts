// Given a static-analysis finding, ask the model to produce ONE self-contained
// test that exercises the failure mode. Polyglot since v0.29.0: the test is
// generated in the language of the file the finding came from —
//   .py            → pytest
//   .go            → go test
//   .ts/.js/.tsx…  → Vitest (the original path)
// and the runner (docker-runner) executes it in the matching sandbox image.
//
// Tests are self-contained — they never import the project under test (so they
// run standalone in the sandbox). When the finding carries the real source
// (codeContext/codeSnippet, populated at analyze time), the model inlines and
// tests THAT actual logic; otherwise it falls back to recreating the foot-gun
// from the finding's description against synthetic inputs.
import { generateObject } from 'ai';
import { z } from 'zod';
import { providerFor, PRIMARY_MODEL, FALLBACK_MODEL, ProviderAttempt } from './llm-client.js';

/** Per-request LLM override (managed BYOK — the user's own key for one call). */
export interface LlmOverride {
  apiKey: string;
  baseURL?: string;
  primaryModel?: string;
  fallbackModel?: string;
}
type Provider = ReturnType<typeof providerFor>;

export type TestLanguage = 'js' | 'python' | 'go';

export interface InputFinding {
  rule: string;
  title: string;
  description: string;
  filePath: string;
  lineNumber: number;
  fixSuggestion: string;
  severity: string;
  /**
   * Optional originating analyzer dimension (e.g. 'security', 'unit', 'load',
   * 'accessibility', 'predictive'). Used by the Tier-2 dimension filter to skip
   * advisory findings that have no testable contract. Safe to omit — the filter
   * falls back to title matching. See ./finding-filter.ts.
   */
  dimension?: string;
  /**
   * Real source at the finding, captured at analyze time. `codeContext` is a
   * ±~10-line window (preferred); `codeSnippet` is the single offending line.
   * When present, the test is grounded in the ACTUAL code rather than just the
   * finding's textual description. Optional — file-less findings (supply-chain,
   * license) and older callers omit both, in which case behavior is unchanged.
   */
  codeSnippet?: string;
  codeContext?: string;
  /**
   * The finding's full source file, when it's a "wireable leaf" (JS/TS, imports
   * only Node built-ins). When present, the generated test IMPORTS this real
   * module and exercises its actual exports instead of recreating the logic.
   * See ./source-wiring.ts. Absent → the codeContext/recreate path is used.
   */
  sourceFile?: { content: string };
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
- Self-contained: do NOT import the project under test. If the prompt includes the actual code, inline that REAL logic faithfully and test it; only when no code is given, recreate the foot-gun with local synthetic inputs.
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
- Self-contained: do NOT import the project under test. If the prompt includes the actual code, inline that REAL logic faithfully and test it; only when no code is given, recreate the foot-gun with local synthetic inputs. Define any helpers inline.
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
- Self-contained: do NOT import the project under test. If the prompt includes the actual code, inline that REAL logic faithfully and test it; only when no code is given, recreate the foot-gun with local synthetic inputs. Define any helper funcs inline in the same file.
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
  /**
   * Extra files to materialize next to the test in the sandbox mount (Approach A
   * wiring): the user's real source module(s) the test imports. The runner
   * writes these verbatim so the test's relative import resolves. Vitest only
   * collects `*.test.ts`, so these are imported, never run as tests.
   */
  companionFiles?: { filename: string; content: string }[];
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

// Wire mode (Approach A): the finding ships its real source module, so the test
// IMPORTS and exercises the actual exports instead of recreating the logic. JS/TS
// only for v1 (esbuild/bundler resolution + CJS interop make it robust).
const WIRE_SYSTEM_JS = `You are a senior test author writing Vitest tests for JavaScript/TypeScript.
You get a static-analysis finding AND the project's REAL source module.
Output ONE Vitest file as JSON: { filename, content, reasoning }.
Hard requirements for content:
- \`import { describe, it, expect } from "vitest"\`
- IMPORT the real module from the given specifier and exercise its ACTUAL exported functions. Do NOT recreate, redefine, or mock the code under test.
- Only use symbols the module actually exports; if something needed isn't exported, test the observable behavior of what is. Do NOT import anything else from the project.
- ≥2 it() blocks: one drives the input that triggers the finding's failure mode, one asserts correct/safe behavior.
- No network, no fs writes, no Date.now()/setTimeout flakiness.
- filename: kebab-case, ends in .test.ts`;

async function generateOne(
  finding: InputFinding,
  cfg: LangConfig,
  model: string,
  attempts: ProviderAttempt[],
  provider: Provider
): Promise<GeneratedTestFile | null> {
  const started = Date.now();
  // Wire mode is JS/TS-only for now; other languages use the self-contained path.
  const wire = cfg.language === 'js' && !!finding.sourceFile?.content;
  // Deterministic names so the test's import specifier and the companion file we
  // write into the sandbox always agree (and stay unique across findings).
  const testFilename = uniqueTestFilename(finding, cfg);
  const companionBase = '__src_' + testFilename.replace(/\.test\.ts$/i, '');
  const importSpec = './' + companionBase;
  try {
    const { object } = await generateObject({
      // AI SDK v6: .chat(model) for OpenAI-compatible providers (OpenRouter).
      model: provider.chat(model),
      schema: schemaFor(cfg),
      system: wire ? WIRE_SYSTEM_JS : cfg.system,
      prompt: `Finding: ${finding.title}
Rule: ${finding.rule || finding.title}
Severity: ${finding.severity}
File: ${finding.filePath}:${finding.lineNumber}
Description: ${finding.description}
Suggested fix: ${finding.fixSuggestion}${
        wire
          ? `

The project's REAL source module is saved alongside your test — import it as "${importSpec}":
\`\`\`
${finding.sourceFile!.content}
\`\`\`
Write a Vitest file that IMPORTS from "${importSpec}" and exercises the real exported code (the flagged behavior at line ${finding.lineNumber} and its safe counterpart). Do not redefine the module.`
          : finding.codeContext || finding.codeSnippet
          ? `

Actual code at ${finding.filePath}:${finding.lineNumber} (\`>\` marks the flagged line):
\`\`\`
${finding.codeContext || finding.codeSnippet}
\`\`\`
Reproduce THIS code's real logic in the test (inline it — do not import the project). Do not invent a different example.`
          : ''
      }

Write the ${cfg.language === 'js' ? 'Vitest' : cfg.language === 'python' ? 'pytest' : 'Go test'} file.`,
      temperature: 0.2,
      maxRetries: 1,
    });
    attempts.push({ model, ok: true, durationMs: Date.now() - started });
    // Override the model-chosen filename with a deterministic, unique one so
    // same-rule findings can't overwrite each other in the run dir. In wire mode
    // ship the real module as a companion the runner writes next to the test.
    return {
      ...object,
      filename: wire ? testFilename : uniqueTestFilename(finding, cfg, object.filename),
      language: cfg.language,
      ...(wire ? { companionFiles: [{ filename: companionBase + '.ts', content: finding.sourceFile!.content }] } : {}),
    };
  } catch (err) {
    attempts.push({ model, ok: false, error: (err as Error).message, durationMs: Date.now() - started });
    return null;
  }
}

export async function generateTestForFinding(finding: InputFinding, override?: LlmOverride): Promise<GenerateResult> {
  const attempts: ProviderAttempt[] = [];
  const cfg = LANGS[detectLanguage(finding.filePath)];
  const provider = providerFor(override);
  const primary = override?.primaryModel || PRIMARY_MODEL;
  const fallback = override?.fallbackModel || FALLBACK_MODEL;
  let file = await generateOne(finding, cfg, primary, attempts, provider);
  if (!file && fallback && fallback !== primary) {
    // Provider rotation — Kimi often succeeds when DeepSeek rate-limits.
    file = await generateOne(finding, cfg, fallback, attempts, provider);
  }
  return { finding, file, attempts };
}

export async function generateTestsForFindings(
  findings: InputFinding[],
  maxFindings = 3,
  override?: LlmOverride,
): Promise<GenerateResult[]> {
  const subset = findings.slice(0, maxFindings);
  return Promise.all(subset.map((f) => generateTestForFinding(f, override)));
}
