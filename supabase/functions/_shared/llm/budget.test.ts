import { assertEquals } from '@std/assert';

import { providerFromEnv } from './config.ts';
import type { FetchLike, LlmRequest } from './types.ts';

const request: LlmRequest = { system: 'Pick one id.', user: '["a"]', schema: { type: 'object' }, maxTokens: 2048 };
const pickId = (value: unknown) => (typeof value === 'object' && value !== null && 'id' in value ? String(value.id) : null);

/** Records each body and answers with the given payloads in order. */
function recorder(...payloads: unknown[]) {
  const bodies: Record<string, unknown>[] = [];
  const fetchFn: FetchLike = (_url, init) => {
    bodies.push(JSON.parse(String(init.body)));
    return Promise.resolve(new Response(JSON.stringify(payloads.shift())));
  };
  return { fetchFn, bodies };
}

Deno.test('every provider maps a cut answer to provider_truncated after one retry with twice the budget', async () => {
  const cases: [Record<string, string>, unknown][] = [
    [{ LLM_PROVIDER: 'gemini', LLM_MODEL: 'gemini-3.6-flash' }, { candidates: [{ finishReason: 'MAX_TOKENS' }] }],
    [{ LLM_PROVIDER: 'openai', LLM_MODEL: 'm' }, { choices: [{ finish_reason: 'length', message: { content: '{' } }] }],
    [{ LLM_PROVIDER: 'anthropic', LLM_MODEL: 'm' }, { stop_reason: 'max_tokens', content: [] }],
  ];
  for (const [env, cut] of cases) {
    const { fetchFn, bodies } = recorder(cut, cut);
    const provider = providerFromEnv((name) => ({ ...env, LLM_API_KEY: 'k' })[name], fetchFn, 'text', 0);
    assertEquals(await provider!.generateJson(request, pickId), { ok: false, error: 'ai_unavailable', reason: 'provider_truncated' });
    const budgets = bodies.map((b) => (b.generationConfig as Record<string, number> | undefined)?.maxOutputTokens ?? b.max_tokens);
    assertEquals(budgets, [2048, 4096], env.LLM_PROVIDER);
  }
});

Deno.test('thinkingConfig goes to Gemini 3 models only (older ones refuse it)', async () => {
  for (const [model, expected] of [['gemini-3.5-flash-lite', { thinkingLevel: 'low' }], ['gemini-2.5-flash', undefined]] as const) {
    const ok = { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"id":"a"}' }] } }] };
    const { fetchFn, bodies } = recorder(ok);
    const provider = providerFromEnv((name) => ({ LLM_PROVIDER: 'gemini', LLM_MODEL: model, LLM_API_KEY: 'k' })[name], fetchFn);
    assertEquals(await provider!.generateJson(request, pickId), { ok: true, value: 'a' });
    assertEquals((bodies[0]?.generationConfig as Record<string, unknown>).thinkingConfig, expected, model);
  }
});
