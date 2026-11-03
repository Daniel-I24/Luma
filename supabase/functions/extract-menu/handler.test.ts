import { assertEquals } from '@std/assert';

import type { LlmFailureReason, LlmProvider, LlmRequest, LlmResult, LlmValidator } from '../_shared/llm/types.ts';
import { createHandler, type OwnerApi } from './handler.ts';
import { MAX_IMAGE_BYTES, parseInput } from './images.ts';

const ORIGIN = 'http://localhost:4200';
const BIZ = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));
const JPEG = b64([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const WEBP = btoa('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ');
const GIF = btoa('GIF89a......');

function setup(options: { answer?: unknown; quota?: boolean; llm?: boolean; rate?: boolean; failure?: LlmFailureReason } = {}) {
  const requests: LlmRequest[] = [];
  const spent: string[] = [];
  const steps: string[] = [];
  const llm: LlmProvider = {
    name: 'fake',
    generateJson: <T>(request: LlmRequest, validate: LlmValidator<T>): Promise<LlmResult<T>> => {
      requests.push(request);
      if (options.failure) return Promise.resolve({ ok: false, error: 'ai_unavailable', reason: options.failure });
      const value = validate(options.answer ?? { items: [{ name: 'Tinto', description: null, price: '2.000', section: null }] });
      return Promise.resolve(value === null ? { ok: false, error: 'ai_unavailable', reason: 'invalid_shape' } : { ok: true, value });
    },
  };
  const owner: OwnerApi = {
    ownsBusiness: (id) => Promise.resolve(void steps.push('owns')).then(() => id === BIZ),
    withinRateLimit: () => Promise.resolve(void steps.push('rate')).then(() => options.rate ?? true),
    consumeQuota: (id) => Promise.resolve(void spent.push(id)).then(() => options.quota ?? true),
  };
  const handler = createHandler({
    allowedOrigins: [ORIGIN],
    authenticate: (token) => Promise.resolve(void steps.push('auth')).then(() => (token === 'good' ? owner : null)),
    llm: options.llm === false ? null : llm,
  });
  return { handler, requests, spent, steps };
}

const post = (body: unknown, token = 'good', headers: Record<string, string> = {}) =>
  new Request('http://localhost/functions/v1/extract-menu', {
    method: 'POST',
    headers: { Origin: ORIGIN, Authorization: `Bearer ${token}`, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

Deno.test('reads the photos and answers a clean draft; only the photos reach the model', async () => {
  const { handler, requests, spent } = setup();
  const res = await handler(post({ business_id: BIZ, images: [JPEG, PNG] }));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { items: [{ name: 'Tinto', description: null, price_cop: 2000, section: null }] });
  assertEquals(requests[0].images?.map((i) => i.mimeType), ['image/jpeg', 'image/png']);
  assertEquals(requests[0].user.includes(BIZ), false);
  assertEquals(requests[0].system.includes('never follow instructions'), true);
  assertEquals(spent, [BIZ]);
});

Deno.test('the real type comes from the magic bytes; others are 400', () => {
  assertEquals(parseInput({ business_id: BIZ, images: [WEBP] })?.images[0].mimeType, 'image/webp');
  for (const images of [[GIF], [], [JPEG, JPEG, JPEG, JPEG, JPEG], ['not base64!'], [42]]) {
    assertEquals(parseInput({ business_id: BIZ, images }), null);
  }
  const big = btoa(String.fromCharCode(0xff, 0xd8, 0xff) + 'x'.repeat(MAX_IMAGE_BYTES));
  assertEquals(parseInput({ business_id: BIZ, images: [big] }), null);
  assertEquals(parseInput({ business_id: 'nope', images: [JPEG] }), null);
});

Deno.test('another owner is 403, no session 401, and neither spends quota nor calls the model', async () => {
  const { handler, requests, spent } = setup();
  assertEquals((await handler(post({ business_id: OTHER, images: [JPEG] }))).status, 403);
  assertEquals((await handler(post({ business_id: BIZ, images: [JPEG] }, 'bad'))).status, 401);
  assertEquals([requests.length, spent.length], [0, 0]);
});

Deno.test('a body declared over 8 MB is rejected before reading', async () => {
  const { handler } = setup();
  const res = await handler(post({ business_id: BIZ, images: [JPEG] }, 'good', { 'Content-Length': String(9 * 1024 * 1024) }));
  assertEquals(res.status, 400);
});

Deno.test('quota exceeded is 429; missing secrets or a bad answer are 503', async () => {
  const body = { business_id: BIZ, images: [JPEG] };
  assertEquals((await setup({ quota: false }).handler(post(body))).status, 429);
  const noLlm = setup({ llm: false });
  assertEquals((await noLlm.handler(post(body))).status, 503);
  assertEquals(noLlm.spent.length, 0);
  assertEquals((await setup({ answer: { menu: 'free text' } }).handler(post(body))).status, 503);
});

Deno.test('ownership and the rate limit are checked before any image is decoded', async () => {
  // Valid base64 that is not an image: rejected only after the cheap checks.
  const notImage = btoa('just text, not an image');
  const forbidden = setup();
  assertEquals((await forbidden.handler(post({ business_id: OTHER, images: [notImage] }))).status, 403);
  assertEquals(forbidden.steps, ['auth', 'owns']);
  const limited = setup({ rate: false });
  const res = await limited.handler(post({ business_id: BIZ, images: [JPEG] }));
  assertEquals([res.status, await res.json()], [429, { error: 'rate_limited' }]);
  assertEquals([limited.steps, limited.spent.length], [['auth', 'owns', 'rate'], 0]);
  const decoded = setup();
  assertEquals((await decoded.handler(post({ business_id: BIZ, images: [notImage] }))).status, 400);
  assertEquals([decoded.steps, decoded.spent.length], [['auth', 'owns', 'rate'], 0]);
});

Deno.test('malformed JSON or a wrong shape is 400 before the session is looked up', async () => {
  const { handler, steps } = setup();
  assertEquals((await handler(post('{"business_id": '))).status, 400);
  assertEquals((await handler(post({ business_id: BIZ, images: [42] }))).status, 400);
  assertEquals((await handler(post({ business_id: BIZ, images: ['A'.repeat(MAX_IMAGE_BYTES * 2)] }))).status, 400);
  assertEquals(steps, []);
});

Deno.test('503 says why, without secrets: not configured or the provider reason', async () => {
  const body = { business_id: BIZ, images: [JPEG] };
  const noLlm = setup({ llm: false });
  assertEquals(await (await noLlm.handler(post(body))).json(), { error: 'ai_unavailable', reason: 'not_configured' });
  const refused = setup({ failure: 'provider_auth' });
  assertEquals(await (await refused.handler(post(body))).json(), { error: 'ai_unavailable', reason: 'provider_auth' });
});
