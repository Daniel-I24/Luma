import { assertEquals } from '@std/assert';

import { providerFromEnv } from './config.ts';
import { createGeminiProvider } from './providers.ts';
import type { FetchLike, LlmRequest } from './types.ts';

/** A provider that answers each call with the next status (200 = a valid answer). */
function provider(...statuses: (number | string)[]) {
  const urls: string[] = [];
  const fetchFn: FetchLike = (url) => {
    urls.push(url);
    const next = statuses.shift() ?? 503;
    if (next === 200) {
      return Promise.resolve(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"id":"a"}' }] } }] })));
    }
    const body = typeof next === 'string' ? next : '{"error":{"status":"UNAVAILABLE"}}';
    return Promise.resolve(new Response(body, { status: typeof next === 'number' ? next : 400 }));
  };
  return { fetchFn, urls };
}

const request: LlmRequest = { system: 'Pick one id.', user: '["a"]', schema: { type: 'object' } };
const pickId = (value: unknown) => (typeof value === 'object' && value !== null && 'id' in value ? String(value.id) : null);
const env = (values: Record<string, string>) => (name: string) => values[name];
const gemini = { LLM_PROVIDER: 'gemini', LLM_MODEL: 'gemini-3.8-flash', LLM_API_KEY: 'k' };

Deno.test('a 503 followed by a 200 is answered after one retry', async () => {
  const { fetchFn, urls } = provider(503, 200);
  const result = await createGeminiProvider({ apiKey: 'k', model: 'm', fetch: fetchFn, retryDelayMs: 0 }).generateJson(request, pickId);
  assertEquals(result, { ok: true, value: 'a' });
  assertEquals(urls.length, 2);
});

Deno.test('500, 502, 503, 504 and "overloaded" are retried twice, then provider_unavailable', async () => {
  for (const status of [500, 502, 503, 504, '{"error":{"message":"The model is overloaded."}}']) {
    const { fetchFn, urls } = provider(status, status, status);
    const result = await createGeminiProvider({ apiKey: 'k', model: 'm', fetch: fetchFn, retryDelayMs: 0 }).generateJson(request, pickId);
    assertEquals(result, { ok: false, error: 'ai_unavailable', reason: 'provider_unavailable' }, String(status));
    assertEquals(urls.length, 3, String(status));
  }
});

Deno.test('a persistent 503 goes to LLM_FALLBACK_MODEL, with the same contract', async () => {
  const { fetchFn, urls } = provider(503, 503, 503, 200);
  const llm = providerFromEnv(env({ ...gemini, LLM_FALLBACK_MODEL: 'gemini-3.1-flash-lite' }), fetchFn, 'text', 0);
  const result = await llm!.generateJson(request, pickId);
  assertEquals(result, { ok: true, value: 'a' });
  assertEquals(urls.length, 4);
  assertEquals(urls[3]?.includes('/models/gemini-3.1-flash-lite:generateContent'), true);
});

Deno.test('the fallback is not used for a refused key, and its own failure is reported', async () => {
  const auth = provider(401, 200);
  const llm = providerFromEnv(env({ ...gemini, LLM_FALLBACK_MODEL: 'gemini-3.1-flash-lite' }), auth.fetchFn, 'text', 0);
  assertEquals(await llm!.generateJson(request, pickId), { ok: false, error: 'ai_unavailable', reason: 'provider_auth' });
  assertEquals(auth.urls.length, 1);

  const down = provider(503, 503, 503, 503, 503, 503);
  const both = providerFromEnv(env({ ...gemini, LLM_FALLBACK_MODEL: 'gemini-3.1-flash-lite' }), down.fetchFn, 'text', 0);
  assertEquals(await both!.generateJson(request, pickId), { ok: false, error: 'ai_unavailable', reason: 'provider_unavailable' });
  assertEquals(down.urls.length, 6);
});

Deno.test('without LLM_FALLBACK_MODEL (or the same model) there is no second model', async () => {
  for (const extra of [{}, { LLM_FALLBACK_MODEL: 'gemini-3.8-flash' }] as Record<string, string>[]) {
    const { fetchFn, urls } = provider(503, 503, 503, 200);
    const llm = providerFromEnv(env({ ...gemini, ...extra }), fetchFn, 'text', 0);
    assertEquals((await llm!.generateJson(request, pickId)).ok, false);
    assertEquals(urls.length, 3);
  }
});
