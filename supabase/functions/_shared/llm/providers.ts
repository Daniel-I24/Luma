import { at, guard, parseAnswer, fail, postJson } from './http.ts';
import type { FetchLike, LlmProvider, LlmRequest, LlmValidator, ProviderOptions } from './types.ts';

const DEFAULT_MAX_TOKENS = 1024;
const JSON_ONLY = 'Answer with a single JSON object that follows the schema. No other text.';

function withSchema(request: LlmRequest): string {
  return `${request.system}\n\n${JSON_ONLY}\nJSON Schema:\n${JSON.stringify(request.schema)}`;
}

const fetchOf = (options: ProviderOptions): FetchLike => options.fetch ?? ((url, init) => fetch(url, init));

/**
 * Google AI Studio (Gemini API, REST generateContent). JSON mode via
 * responseMimeType; the schema travels in the instructions and the answer
 * is validated by the caller.
 */
export function createGeminiProvider(options: ProviderOptions): LlmProvider {
  const base = options.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
  return {
    name: 'gemini',
    generateJson: <T>(request: LlmRequest, validate: LlmValidator<T>) =>
      guard<T>(async () => {
        const body = await postJson(
          fetchOf(options),
          `${base}/models/${encodeURIComponent(options.model)}:generateContent`,
          { 'x-goog-api-key': options.apiKey },
          {
            systemInstruction: { parts: [{ text: withSchema(request) }] },
            contents: [{ role: 'user', parts: [{ text: request.user }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              maxOutputTokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
            },
          },
          options.timeoutMs,
        );
        const text = at(body, 'candidates', 0, 'content', 'parts', 0, 'text');
        return parseAnswer(typeof text === 'string' ? text : null, validate);
      }),
  };
}

/**
 * OpenAI-compatible chat completions (Groq, OpenRouter and others, chosen
 * by base URL). json_object mode, which needs the word JSON in the prompt.
 */
export function createOpenAiCompatibleProvider(options: ProviderOptions): LlmProvider {
  const base = (options.baseUrl ?? 'https://api.groq.com/openai/v1').replace(/\/$/, '');
  return {
    name: 'openai-compatible',
    generateJson: <T>(request: LlmRequest, validate: LlmValidator<T>) =>
      guard<T>(async () => {
        const body = await postJson(
          fetchOf(options),
          `${base}/chat/completions`,
          { authorization: `Bearer ${options.apiKey}` },
          {
            model: options.model,
            max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: withSchema(request) },
              { role: 'user', content: request.user },
            ],
          },
          options.timeoutMs,
        );
        const text = at(body, 'choices', 0, 'message', 'content');
        return parseAnswer(typeof text === 'string' ? text : null, validate);
      }),
  };
}

/** Anthropic Messages API, with structured outputs (output_config.format). */
export function createAnthropicProvider(options: ProviderOptions): LlmProvider {
  const base = (options.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '');
  return {
    name: 'anthropic',
    generateJson: <T>(request: LlmRequest, validate: LlmValidator<T>) =>
      guard<T>(async () => {
        const body = await postJson(
          fetchOf(options),
          `${base}/v1/messages`,
          { 'x-api-key': options.apiKey, 'anthropic-version': '2023-06-01' },
          {
            model: options.model,
            max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
            system: request.system,
            messages: [{ role: 'user', content: request.user }],
            output_config: { format: { type: 'json_schema', schema: request.schema } },
          },
          options.timeoutMs,
        );
        if (at(body, 'stop_reason') === 'refusal') return fail('refused');
        const blocks = at(body, 'content');
        const text = Array.isArray(blocks)
          ? blocks.find((block) => at(block, 'type') === 'text')
          : undefined;
        const value = at(text, 'text');
        return parseAnswer(typeof value === 'string' ? value : null, validate);
      }),
  };
}
