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
export const PRIMARY_MODEL = 'qwen/qwen3.7-max';
export const FALLBACK_MODEL = 'deepseek/deepseek-v4-flash';

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
