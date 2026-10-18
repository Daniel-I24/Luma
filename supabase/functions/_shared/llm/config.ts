import {
  createAnthropicProvider,
  createGeminiProvider,
  createOpenAiCompatibleProvider,
} from './providers.ts';
import type { FetchLike, LlmProvider } from './types.ts';

export const LLM_PROVIDERS = ['gemini', 'openai', 'anthropic'] as const;
export type LlmProviderName = (typeof LLM_PROVIDERS)[number];

/**
 * The provider chosen by secrets only: LLM_PROVIDER (gemini | openai |
 * anthropic), LLM_MODEL, LLM_API_KEY and, optionally, LLM_BASE_URL (for
 * "openai": Groq, OpenRouter...). Null when anything is missing, so the
 * caller answers ai_unavailable and the app uses its rules.
 */
export function providerFromEnv(
  get: (name: string) => string | undefined,
  fetchFn?: FetchLike,
): LlmProvider | null {
  const name = get('LLM_PROVIDER')?.trim().toLowerCase();
  const model = get('LLM_MODEL')?.trim();
  const apiKey = get('LLM_API_KEY')?.trim();
  const baseUrl = get('LLM_BASE_URL')?.trim() || undefined;
  if (!name || !model || !apiKey) return null;
  const options = { apiKey, model, baseUrl, fetch: fetchFn };
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
