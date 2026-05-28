// OpenRouter LLM client. We don't hit DeepSeek / Kimi APIs directly because
// the LiteLLM proxy that used to broker them is gone (history.md note 2026-05-20);
// OpenRouter exposes both providers behind one OpenAI-compatible base URL with
// a single key (OPENROUTER_API_KEY). Per the AI SDK v6 quirk, we MUST use
// .chat(model) — createOpenAI(...)(model) defaults to the Responses API which
// OpenRouter does not implement.
import { createOpenAI } from '@ai-sdk/openai';

// Primary: Qwen 3.7 Max — 1M context, top-tier reasoning, ideal for detailed
// generation with non-trivial constraint-following. Fallback: DeepSeek V4 Flash
// — cheap, fast, different lineage (good ensemble diversity if Qwen rejects
// the schema). Both via OpenRouter under one OPENROUTER_API_KEY.
//
// Env overrides let ops swap models without a rebuild — also makes the
// fallback path testable by temporarily pointing PRIMARY at a bogus id.
// Defaults chosen for reasonable cost (per-M tokens, OpenRouter):
//   deepseek-v4-flash  $0.10 in / $0.20 out  (primary — cheapest capable coder)
//   kimi-k2.6          $0.73 in / $3.49 out  (fallback — different provider; only
//                                             hit when deepseek rate-limits/fails)
// vs the old qwen3.7-max at $1.25 / $3.75. Override either with env.
export const PRIMARY_MODEL = process.env.TESTFORGE_PRIMARY_MODEL || 'deepseek/deepseek-v4-flash';
export const FALLBACK_MODEL = process.env.TESTFORGE_FALLBACK_MODEL || 'moonshotai/kimi-k2.6';

const apiKey = process.env.OPENROUTER_API_KEY;

export const openrouter = createOpenAI({
  apiKey: apiKey ?? '',
  baseURL: 'https://openrouter.ai/api/v1',
  // OpenRouter appreciates these for free-tier rate-limit accounting.
  headers: {
    'HTTP-Referer': 'https://testforge.run',
    'X-Title': 'TestForge MCP - Generate & Run',
  },
});

export function hasLLMKey(): boolean {
  return Boolean(apiKey && apiKey.length > 10);
}

export interface ProviderAttempt {
  model: string;
  ok: boolean;
  error?: string;
  durationMs: number;
}
