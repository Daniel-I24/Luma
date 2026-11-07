import { assertEquals } from '@std/assert';

import type { SendResult } from './fcm.ts';
import { createHandler, shouldRetry } from './handler.ts';
import type { PushRow } from './messages.ts';

const SECRET = 's'.repeat(40);
const row = (n: number, tokens: string[]): PushRow => ({
  notification_id: `n${n}`, type: 'order_status', status: 'ready', order_id: `o${n}`, business_id: 'b1',
  business_name: 'Café Público', tokens,
});

function setup(options: { batches?: PushRow[][]; retries?: PushRow[]; results?: Record<string, SendResult | 'throw'> }) {
  const batches = [...(options.batches ?? [])];
  const sent: string[] = [];
  const scheduled: [string, string[], number][] = [];
  const handler = createHandler({
    secret: SECRET,
    store: {
      claim: () => Promise.resolve(batches.shift() ?? []),
      claimRetries: () => Promise.resolve(options.retries ?? []),
      scheduleRetry: (id, tokens, attempt) => {
        scheduled.push([id, tokens, attempt]);
        return Promise.resolve(attempt >= 3 ? 0 : tokens.length);
      },
      removeTokens: () => Promise.resolve(),
    },
    sender: {
      send: (token) => {
        sent.push(token);
        const result = options.results?.[token] ?? 'sent';
        return result === 'throw' ? Promise.reject(new Error('network')) : Promise.resolve(result);
      },
    },
  });
  return { handler, sent, scheduled };
}

const post = () => new Request('http://x', { method: 'POST', headers: { 'x-push-secret': SECRET } });

Deno.test('a passing fault is tried again, only for the phone that failed', async () => {
  const { handler, scheduled } = setup({
    batches: [[row(1, ['t-ok', 't-down'])]], results: { 't-down': 'failed:UNAVAILABLE' },
  });
  const res = await handler(post());
  const body = await res.json();
  assertEquals(scheduled, [['n1', ['t-down'], 0]]);
  assertEquals([body.sent, body.failed, body.retrying], [1, 1, 1]);
});

Deno.test('a network error is tried again; a permanent FCM answer is not', async () => {
  const { handler, scheduled } = setup({
    batches: [[row(1, ['t-net', 't-bad', 't-wrong'])]],
    results: { 't-net': 'throw', 't-bad': 'failed:INVALID_ARGUMENT', 't-wrong': 'failed:SENDER_ID_MISMATCH' },
  });
  await handler(post());
  assertEquals(scheduled, [['n1', ['t-net'], 0]]);
  assertEquals([shouldRetry('UNAVAILABLE'), shouldRetry('INTERNAL'), shouldRetry('unknown'), shouldRetry('fcm_auth_failed')], [true, true, true, true]);
  assertEquals([shouldRetry('INVALID_ARGUMENT'), shouldRetry('THIRD_PARTY_AUTH_ERROR')], [false, false]);
});

Deno.test('due retries are sent, carry their attempt, and stop when the attempts end', async () => {
  const { handler, sent, scheduled } = setup({
    batches: [[]],
    retries: [{ ...row(2, ['t-down']), attempt: 3 }],
    results: { 't-down': 'failed:UNAVAILABLE' },
  });
  const res = await handler(post());
  const body = await res.json();
  assertEquals(sent.length, 1);
  assertEquals(scheduled, [['n2', ['t-down'], 3]]);
  assertEquals(body.retrying, 0);
});
