import { assertEquals } from '@std/assert';

import { providerFromEnv } from './config.ts';
import {
  createAnthropicProvider,
  createGeminiProvider,
  createOpenAiCompatibleProvider,
} from './providers.ts';
import type { FetchLike, LlmRequest } from './types.ts';

interface Call {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/** Answers each call with the next response; records what was sent. */
function fakeFetch(...responses: (Response | 'hang')[]) {
  const calls: Call[] = [];
  const fetchFn: FetchLike = (url, init) => {
    calls.push({
      url,
      headers: init.headers as Record<string, string>,
      body: JSON.parse(String(init.body)),
    });
    const next = responses.shift() ?? new Response('{}', { status: 500 });
    if (next !== 'hang') return Promise.resolve(next);
    return new Promise((_, reject) =>
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
    );
  };
  return { fetchFn, calls };
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const request: LlmRequest = {
  system: 'Pick one id.',
  user: 'Candidates: ["a","b"]',
  schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
};
const pickId = (value: unknown) =>
  typeof value === 'object' && value !== null && 'id' in value && (value.id === 'a' || value.id === 'b')
    ? (value.id as string)
    : null;
const options = (fetchFn: FetchLike) => ({ apiKey: 'k', model: 'm', fetch: fetchFn, timeoutMs: 50 });

Deno.test('gemini: REST generateContent with the key header and JSON mode', async () => {
  const { fetchFn, calls } = fakeFetch(json({ candidates: [{ content: { parts: [{ text: '{"id":"a"}' }] } }] }));
  const result = await createGeminiProvider(options(fetchFn)).generateJson(request, pickId);

  assertEquals(result, { ok: true, value: 'a' });
  assertEquals(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/m:generateContent');
  assertEquals(calls[0].headers['x-goog-api-key'], 'k');
  assertEquals((calls[0].body.generationConfig as Record<string, unknown>).responseMimeType, 'application/json');
});

Deno.test('openai-compatible: chat completions on the configured base URL', async () => {
  const { fetchFn, calls } = fakeFetch(json({ choices: [{ message: { content: '```json\n{"id":"b"}\n```' } }] }));
  const provider = createOpenAiCompatibleProvider({ ...options(fetchFn), baseUrl: 'https://openrouter.ai/api/v1/' });
  const result = await provider.generateJson(request, pickId);

  assertEquals(result, { ok: true, value: 'b' });
  assertEquals(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');
  assertEquals(calls[0].headers.authorization, 'Bearer k');
  assertEquals(calls[0].body.response_format, { type: 'json_object' });
  assertEquals((calls[0].body.messages as { role: string }[]).map((m) => m.role), ['system', 'user']);
});

Deno.test('anthropic: messages API with structured outputs, skipping non-text blocks', async () => {
  const { fetchFn, calls } = fakeFetch(
    json({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"id":"a"}' }] }),
  );
  const result = await createAnthropicProvider(options(fetchFn)).generateJson(request, pickId);

  assertEquals(result, { ok: true, value: 'a' });
  assertEquals(calls[0].url, 'https://api.anthropic.com/v1/messages');
  assertEquals(calls[0].headers['x-api-key'], 'k');
  assertEquals(calls[0].headers['anthropic-version'], '2023-06-01');
  assertEquals(calls[0].body.output_config, { format: { type: 'json_schema', schema: request.schema } });
});

Deno.test('anthropic: a refusal is ai_unavailable', async () => {
  const { fetchFn } = fakeFetch(json({ stop_reason: 'refusal', content: [] }));
  const result = await createAnthropicProvider(options(fetchFn)).generateJson(request, pickId);
  assertEquals(result, { ok: false, error: 'ai_unavailable', reason: 'refused' });
});

Deno.test('invalid JSON and ids outside the candidate set are rejected', async () => {
  const bad = (text: string) => json({ choices: [{ message: { content: text } }] });
  const { fetchFn } = fakeFetch(bad('not json'), bad('{"id":"zzz"}'));
  const provider = createOpenAiCompatibleProvider(options(fetchFn));

  assertEquals((await provider.generateJson(request, pickId)).ok, false);
  assertEquals(await provider.generateJson(request, pickId), {
    ok: false,
    error: 'ai_unavailable',
    reason: 'invalid_shape',
  });
});

Deno.test('a timeout is retried once, then reported', async () => {
  const { fetchFn, calls } = fakeFetch('hang', 'hang');
  const result = await createGeminiProvider(options(fetchFn)).generateJson(request, pickId);

  assertEquals(result, { ok: false, error: 'ai_unavailable', reason: 'timeout' });
  assertEquals(calls.length, 2);
});

Deno.test('5xx and 429 are retried once; other 4xx are not', async () => {
  const retried = fakeFetch(json({}, 503), json({ choices: [{ message: { content: '{"id":"a"}' } }] }));
  assertEquals(
    (await createOpenAiCompatibleProvider(options(retried.fetchFn)).generateJson(request, pickId)).ok,
    true,
  );
  const notRetried = fakeFetch(json({}, 401), json({}, 200));
  const result = await createOpenAiCompatibleProvider(options(notRetried.fetchFn)).generateJson(request, pickId);
  assertEquals(result, { ok: false, error: 'ai_unavailable', reason: 'http_error' });
  assertEquals(notRetried.calls.length, 1);
});

Deno.test('the provider comes from secrets only, and nothing without them', () => {
  const env = (values: Record<string, string>) => (name: string) => values[name];
  assertEquals(providerFromEnv(env({ LLM_PROVIDER: 'gemini', LLM_MODEL: 'm', LLM_API_KEY: 'k' }))?.name, 'gemini');
  assertEquals(providerFromEnv(env({ LLM_PROVIDER: 'OpenAI', LLM_MODEL: 'm', LLM_API_KEY: 'k' }))?.name, 'openai-compatible');
  assertEquals(providerFromEnv(env({ LLM_PROVIDER: 'anthropic', LLM_MODEL: 'm' })), null);
  assertEquals(providerFromEnv(env({ LLM_PROVIDER: 'other', LLM_MODEL: 'm', LLM_API_KEY: 'k' })), null);
});
