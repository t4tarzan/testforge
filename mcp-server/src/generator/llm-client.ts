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
// Provider endpoint is configurable so self-hosters can point Tier-2 test
// generation at ANY OpenAI-compatible API — OpenRouter (default), a local model
// server (Ollama `http://localhost:11434/v1`, LM Studio `http://localhost:1234/v1`),
// vLLM, or OpenAI itself. `TESTFORGE_LLM_API_KEY` takes precedence over
// `OPENROUTER_API_KEY`; local servers usually accept any non-empty key.
//
// These are `let` exports (live ES bindings) re-derived by reloadLLM(), so the
// settings panel can change the provider/key at runtime and the next generation
// picks it up WITHOUT a server restart — importers read the live value.
export let PRIMARY_MODEL = '';
export let FALLBACK_MODEL = '';
export let LLM_BASE_URL = '';
export let LLM_IS_LOCAL = false;
let apiKey: string | undefined;

const COMMON_HEADERS = {
  // OpenRouter appreciates these for rate-limit accounting (harmless elsewhere).
  'HTTP-Referer': 'https://testforge.run',
  'X-Title': 'TestForge MCP - Generate & Run',
};

function mkProvider() {
  return createOpenAI({
    // Local servers don't need a real key; send a placeholder so the SDK doesn't
    // error on an empty string.
    apiKey: apiKey ?? (LLM_IS_LOCAL ? 'local' : ''),
    baseURL: LLM_BASE_URL,
    headers: COMMON_HEADERS,
  });
}

export let openrouter = mkProvider();

/**
 * Provider for a SINGLE request that brings its own key — managed BYOK: the
 * Vercel proxy forwards a user's own OpenRouter key per request so the hosted
 * Tier-2 uses the USER's key (and their OpenRouter billing), never ours. Falls
 * back to the server's default provider when no per-request key is given.
 */
export function providerFor(override?: { apiKey?: string; baseURL?: string }) {
  if (!override?.apiKey) return openrouter;
  return createOpenAI({
    apiKey: override.apiKey,
    baseURL: override.baseURL || 'https://openrouter.ai/api/v1',
    headers: COMMON_HEADERS,
  });
}

/** Re-read the LLM config from process.env and rebuild the provider. Called at
 *  startup and after the settings panel (`POST /config`) changes the env. */
export function reloadLLM(): void {
  LLM_BASE_URL = process.env.TESTFORGE_LLM_BASE_URL || 'https://openrouter.ai/api/v1';
  apiKey = process.env.TESTFORGE_LLM_API_KEY || process.env.OPENROUTER_API_KEY;
  LLM_IS_LOCAL = /localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal/.test(LLM_BASE_URL);
  PRIMARY_MODEL = process.env.TESTFORGE_PRIMARY_MODEL || 'deepseek/deepseek-v4-flash';
  FALLBACK_MODEL = process.env.TESTFORGE_FALLBACK_MODEL || 'moonshotai/kimi-k2.6';
  openrouter = mkProvider();
}
reloadLLM();

// Tier-2 is usable if we have a real key OR are pointed at a local model server.
export function hasLLMKey(): boolean {
  return LLM_IS_LOCAL || Boolean(apiKey && apiKey.length > 10);
}

export interface ProviderAttempt {
  model: string;
  ok: boolean;
  error?: string;
  durationMs: number;
}
