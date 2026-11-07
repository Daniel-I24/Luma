import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { candidates } from './check-wompi-event.mjs';
import { eventsSecretFrom, replay, signedEvent } from './wompi-replay.mjs';

const TX = { id: '1-1', status: 'APPROVED', amount_in_cents: 1000000, reference: 'r', currency: 'COP' };
const SECRET = 'test_events_ABC';

test('the event is signed with the documented algorithm, the one the webhook checks', () => {
  const event = signedEvent(TX, SECRET, 1700000000000);
  const documented = candidates(event, SECRET)['documented: properties (in order) + timestamp + secret'];
  assert.equal(event.signature.checksum, documented);
  assert.equal(event.environment, 'test');
});

test('only a sandbox events secret is accepted: a production one is not read', () => {
  assert.equal(eventsSecretFrom(`x test_events_ABC y`), SECRET);
  assert.equal(eventsSecretFrom('prod_events_ABC'), null);
  assert.equal(eventsSecretFrom('pub_test_A prv_test_B'), null);
});

test('forged, repeated and late events: what is sent and how it is judged', async () => {
  const sent = [];
  const answers = [400, 200, 200, 200];
  const lines = await replay({
    webhookUrl: 'https://x.test/wompi-webhook', transaction: TX, secret: SECRET, now: 1700000000000,
    fetchFn: async (_url, init) => { sent.push(JSON.parse(init.body)); return { status: answers.shift() }; },
  });
  assert.equal(lines.every((l) => l.ok), true);
  assert.equal(sent[0].signature.checksum, '0'.repeat(64), 'the first one is forged');
  assert.deepEqual(sent[1], sent[2], 'the repeat is the very same event');
  assert.ok(sent[3].timestamp < sent[1].timestamp, 'the late one is older');
  assert.notEqual(sent[3].signature.checksum, sent[1].signature.checksum, 'and correctly signed for its time');
});

test('a webhook that accepts a forged event is reported as a failure', async () => {
  const lines = await replay({
    webhookUrl: 'https://x.test', transaction: TX, secret: SECRET, now: 1, fetchFn: async () => ({ status: 200 }),
  });
  assert.equal(lines[0].ok, false);
});

test('the script prints no secret', () => {
  const code = readFileSync(new URL('./wompi-replay.mjs', import.meta.url), 'utf8');
  const printing = code.split('\n').filter((line) => /process\.std(out|err)\.write/.test(line));
  assert.equal(printing.some((line) => /secret\b(?! )/i.test(line.replace(/secreto|secret\)/gi, ''))), false);
});
