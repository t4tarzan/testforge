// Given a static-analysis finding (currently from the edge-case dimension),
// ask the model to produce one Vitest test file that exercises the failure.
//
// Day 1 intentionally generates from the finding metadata alone — rule,
// description, fixSuggestion, filePath, lineNumber. The generated tests
// are pattern-level (they recreate the foot-gun against synthetic inputs)
// rather than file-precise. Day 2 will pass code snippets + the cloned
// repo path into a Fly Machine for execution.
import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter, PRIMARY_MODEL, FALLBACK_MODEL, ProviderAttempt } from './llm-client.js';

export interface InputFinding {
  rule: string;          // 'parseInt-no-radix' etc. — sometimes the title carries this
  title: string;
  description: string;
  filePath: string;
  lineNumber: number;
  fixSuggestion: string;
  severity: string;
}

const TestFileSchema = z.object({
  filename: z
    .string()
    .describe(
      'Test filename ending in .test.ts. Should be slugged from the rule + line, e.g. parseInt-no-radix-l142.test.ts'
    ),
  content: z
    .string()
    .describe(
      'Full Vitest test file source. Must use `import { describe, it, expect } from "vitest"`. Should contain at least 2 it() blocks — one that demonstrates the foot-gun (and is expected to surface the failure mode), one that asserts the safe fix works.'
    ),
  reasoning: z
    .string()
    .describe('One short sentence explaining what the test exercises.'),
});

export type GeneratedTestFile = z.infer<typeof TestFileSchema>;

const SYSTEM_PROMPT = `You are a senior test author. You write Vitest tests for JavaScript / TypeScript code.
You will be given ONE static-analysis finding describing a pattern that risks breaking in production.
Output ONE Vitest file (in JSON: { filename, content, reasoning }).

Hard requirements for the content:
- Use \`import { describe, it, expect } from "vitest"\`
- Do NOT import from the project under test. The test must be self-contained — recreate the foot-gun pattern with local synthetic inputs.
- Include at least 2 it() blocks: one that demonstrates the failure mode (so a future code change closing the gap turns it green), one that asserts the suggested fix behaves correctly.
- No external network, no fs writes, no Date.now() / setTimeout flakiness.
- Filename: kebab-case, ends in .test.ts.`;

export interface GenerateResult {
  finding: InputFinding;
  file: GeneratedTestFile | null;
  attempts: ProviderAttempt[];
}

async function generateOne(
  finding: InputFinding,
  model: string,
  attempts: ProviderAttempt[]
): Promise<GeneratedTestFile | null> {
  const started = Date.now();
  try {
    const { object } = await generateObject({
      // AI SDK v6: must use .chat(model) for OpenAI-compatible providers like
      // OpenRouter, otherwise the SDK posts to /responses which they don't serve.
      model: openrouter.chat(model),
      schema: TestFileSchema,
      system: SYSTEM_PROMPT,
      prompt: `Finding: ${finding.title}
Rule: ${finding.rule || finding.title}
Severity: ${finding.severity}
File: ${finding.filePath}:${finding.lineNumber}
Description: ${finding.description}
Suggested fix: ${finding.fixSuggestion}

Write the Vitest file.`,
      temperature: 0.2,
      maxRetries: 1,
    });
    attempts.push({ model, ok: true, durationMs: Date.now() - started });
    return object;
  } catch (err) {
    attempts.push({
      model,
      ok: false,
      error: (err as Error).message,
      durationMs: Date.now() - started,
    });
    return null;
  }
}

export async function generateTestForFinding(finding: InputFinding): Promise<GenerateResult> {
  const attempts: ProviderAttempt[] = [];
  let file = await generateOne(finding, PRIMARY_MODEL, attempts);
  if (!file) {
    // Provider rotation — Kimi has a different temperament than DeepSeek and
    // often succeeds when DeepSeek hits rate-limit or returns invalid JSON.
    file = await generateOne(finding, FALLBACK_MODEL, attempts);
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
