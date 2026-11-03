import { assertEquals } from '@std/assert';

import { providerFromEnv, VISION_TIMEOUT_MS } from './config.ts';
import {
  createAnthropicProvider,
  createGeminiProvider,
  createOpenAiCompatibleProvider,
} from './providers.ts';
import type { FetchLike, LlmRequest } from './types.ts';

function recorder(answer: unknown) {
  const bodies: Record<string, unknown>[] = [];
  const fetchFn: FetchLike = (_url, init) => {
    bodies.push(JSON.parse(String(init.body)));
    return Promise.resolve(new Response(JSON.stringify(answer)));
  };
  return { fetchFn, bodies };
}

const request: LlmRequest = {
  system: 'Read the menu.',
  user: '{"business":"x"}',
  schema: { type: 'object' },
  images: [{ mimeType: 'image/webp', base64: 'AAAA' }],
};
const any = (value: unknown) => value;
const opts = (fetchFn: FetchLike) => ({ apiKey: 'k', model: 'm', fetch: fetchFn });
type Turn = { content?: unknown; parts?: unknown };

Deno.test('gemini sends images as inlineData before the text', async () => {
  const { fetchFn, bodies } = recorder({ candidates: [{ content: { parts: [{ text: '{}' }] } }] });
  await createGeminiProvider(opts(fetchFn)).generateJson(request, any);
  assertEquals((bodies[0].contents as Turn[])[0].parts, [
    { inlineData: { mimeType: 'image/webp', data: 'AAAA' } },
    { text: '{"business":"x"}' },
  ]);
});

Deno.test('openai-compatible sends images as data URLs', async () => {
  const { fetchFn, bodies } = recorder({ choices: [{ message: { content: '{}' } }] });
  await createOpenAiCompatibleProvider(opts(fetchFn)).generateJson(request, any);
  assertEquals((bodies[0].messages as Turn[])[1].content, [
    { type: 'text', text: '{"business":"x"}' },
    { type: 'image_url', image_url: { url: 'data:image/webp;base64,AAAA' } },
  ]);
});

Deno.test('anthropic sends base64 image blocks; text-only requests stay a string', async () => {
  const { fetchFn, bodies } = recorder({ content: [{ type: 'text', text: '{}' }] });
  const provider = createAnthropicProvider(opts(fetchFn));
  await provider.generateJson(request, any);
  await provider.generateJson({ ...request, images: undefined }, any);
  assertEquals((bodies[0].messages as Turn[])[0].content, [
    { type: 'image', source: { type: 'base64', media_type: 'image/webp', data: 'AAAA' } },
    { type: 'text', text: '{"business":"x"}' },
  ]);
  assertEquals((bodies[1].messages as Turn[])[0].content, '{"business":"x"}');
});

Deno.test('vision uses LLM_VISION_MODEL when set, LLM_MODEL otherwise', async () => {
  const urls: string[] = [];
  const fetchFn: FetchLike = (url) => {
    urls.push(url);
    return Promise.resolve(new Response('{}', { status: 400 }));
  };
  const env = (vision?: string) => (name: string): string | undefined =>
    ({ LLM_PROVIDER: 'gemini', LLM_MODEL: 'text-m', LLM_API_KEY: 'k', LLM_VISION_MODEL: vision })[name];
  await providerFromEnv(env('vision-m'), fetchFn, 'vision')?.generateJson(request, any);
  await providerFromEnv(env(), fetchFn, 'vision')?.generateJson(request, any);
  await providerFromEnv(env('vision-m'), fetchFn)?.generateJson(request, any);
  assertEquals(urls.map((u) => u.split('/models/')[1].split(':')[0]), ['vision-m', 'text-m', 'text-m']);
  assertEquals(VISION_TIMEOUT_MS, 30_000);
});
