import {
  createAnthropicProvider,
  createGeminiProvider,
  createOpenAiCompatibleProvider,
} from './providers.ts';
import type {
  FetchLike,
  LlmFailureReason,
  LlmProvider,
  LlmRequest,
  LlmResult,
  LlmValidator,
  ProviderOptions,
} from './types.ts';

/** Image requests are bigger and slower than text ones. */
export const VISION_TIMEOUT_MS = 30_000;
export type LlmPurpose = 'text' | 'vision';

/**
 * Failures a second model can get around: the first one is saturated, too
 * slow, out of quota or unknown. Never a refused key (the same key fails).
 */
const FALLBACK_REASONS: ReadonlySet<LlmFailureReason> = new Set([
  'provider_unavailable', 'timeout', 'provider_rate_limit', 'provider_model',
]);
/** A truncated answer is retried once with this many times the budget, up to the cap. */
const TRUNCATED_BUDGET_FACTOR = 2;
const MAX_BUDGET = 16_384;
const DEFAULT_BUDGET = 1024;

/**
 * The provider chosen by secrets only: LLM_PROVIDER (gemini | openai |
 * anthropic), LLM_MODEL, LLM_API_KEY and, optionally, LLM_BASE_URL (for
 * "openai": Groq, OpenRouter...). Null when anything is missing, so the
 * caller answers ai_unavailable and the app uses its rules. For "vision",
 * LLM_VISION_MODEL (when set) replaces LLM_MODEL and the timeout is longer.
 * LLM_FALLBACK_MODEL (same provider and key, same contract) answers when
 * the main model stays saturated after its retries.
 */
export function providerFromEnv(
  get: (name: string) => string | undefined,
  fetchFn?: FetchLike,
  purpose: LlmPurpose = 'text',
  retryDelayMs?: number,
): LlmProvider | null {
  const name = get('LLM_PROVIDER')?.trim().toLowerCase();
  const vision = purpose === 'vision' ? get('LLM_VISION_MODEL')?.trim() : undefined;
  const model = vision || get('LLM_MODEL')?.trim();
  const apiKey = get('LLM_API_KEY')?.trim();
  const baseUrl = get('LLM_BASE_URL')?.trim() || undefined;
  if (!name || !model || !apiKey) return null;
  const timeoutMs = purpose === 'vision' ? VISION_TIMEOUT_MS : undefined;
  const options = { apiKey, model, baseUrl, fetch: fetchFn, timeoutMs, retryDelayMs };
  const primary = create(name, options);
  const fallbackModel = get('LLM_FALLBACK_MODEL')?.trim();
  if (!primary || !fallbackModel || fallbackModel === model) return primary;
  const fallback = create(name, { ...options, model: fallbackModel });
  return fallback ? withFallback(primary, fallback) : primary;
}

function create(name: string, options: ProviderOptions): LlmProvider | null {
  const provider = byName(name, options);
  return provider && withMoreBudget(provider);
}

function byName(name: string, options: ProviderOptions): LlmProvider | null {
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

/** finishReason MAX_TOKENS (or length / max_tokens): one more try with twice the budget. */
function withMoreBudget(provider: LlmProvider): LlmProvider {
  return {
    name: provider.name,
    async generateJson<T>(request: LlmRequest, validate: LlmValidator<T>): Promise<LlmResult<T>> {
      const first = await provider.generateJson(request, validate);
      if (first.ok || first.reason !== 'provider_truncated') return first;
      const maxTokens = Math.min((request.maxTokens ?? DEFAULT_BUDGET) * TRUNCATED_BUDGET_FACTOR, MAX_BUDGET);
      return provider.generateJson({ ...request, maxTokens }, validate);
    },
  };
}

/** Asks the fallback model only when the main one failed in a way it can get around. */
function withFallback(primary: LlmProvider, fallback: LlmProvider): LlmProvider {
  return {
    name: primary.name,
    async generateJson<T>(request: LlmRequest, validate: LlmValidator<T>): Promise<LlmResult<T>> {
      const first = await primary.generateJson(request, validate);
      if (first.ok || !FALLBACK_REASONS.has(first.reason)) return first;
      return fallback.generateJson(request, validate);
    },
  };
}
