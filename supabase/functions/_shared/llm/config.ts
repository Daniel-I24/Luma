import {
  createAnthropicProvider,
  createGeminiProvider,
  createOpenAiCompatibleProvider,
} from './providers.ts';
import type { FetchLike, LlmProvider } from './types.ts';

export const LLM_PROVIDERS = ['gemini', 'openai', 'anthropic'] as const;
export type LlmProviderName = (typeof LLM_PROVIDERS)[number];

/** Image requests are bigger and slower than text ones. */
export const VISION_TIMEOUT_MS = 30_000;
export type LlmPurpose = 'text' | 'vision';

/**
 * The provider chosen by secrets only: LLM_PROVIDER (gemini | openai |
 * anthropic), LLM_MODEL, LLM_API_KEY and, optionally, LLM_BASE_URL (for
 * "openai": Groq, OpenRouter...). Null when anything is missing, so the
 * caller answers ai_unavailable and the app uses its rules. For "vision",
 * LLM_VISION_MODEL (when set) replaces LLM_MODEL and the timeout is longer.
 */
export function providerFromEnv(
  get: (name: string) => string | undefined,
  fetchFn?: FetchLike,
  purpose: LlmPurpose = 'text',
): LlmProvider | null {
  const name = get('LLM_PROVIDER')?.trim().toLowerCase();
  const vision = purpose === 'vision' ? get('LLM_VISION_MODEL')?.trim() : undefined;
  const model = vision || get('LLM_MODEL')?.trim();
  const apiKey = get('LLM_API_KEY')?.trim();
  const baseUrl = get('LLM_BASE_URL')?.trim() || undefined;
  if (!name || !model || !apiKey) return null;
  const timeoutMs = purpose === 'vision' ? VISION_TIMEOUT_MS : undefined;
  const options = { apiKey, model, baseUrl, fetch: fetchFn, timeoutMs };
  switch (name) {
    case 'gemini':
      return createGeminiProvider(options);
    case 'openai':
      return createOpenAiCompatibleProvider(options);
    case 'anthropic':
      return createAnthropicProvider(options);
    default:
      return null;
  }
}
