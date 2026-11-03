import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { candidates, matches, valueAt } from './check-wompi-event.mjs';

// An invented sandbox-shaped event and secret (no real value).
const secret = 'test_events_' + 'x'.repeat(20);
const event = {
  event: 'transaction.updated',
  data: { transaction: { id: '1234-1610641025-49201', status: 'APPROVED', amount_in_cents: 4490000 } },
  signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'] },
  timestamp: 1530291411,
};
const documented = createHash('sha256')
  .update('1234-1610641025-49201APPROVED4490000' + '1530291411' + secret)
  .digest('hex');

test('reads dotted properties of event.data', () => {
  assert.equal(valueAt(event.data, 'transaction.amount_in_cents'), 4490000);
  assert.equal(valueAt(event.data, 'transaction.missing.deep'), undefined);
});

test('the documented algorithm matches the checksum Wompi computes', () => {
  assert.deepEqual(matches(event, secret, documented.toUpperCase()), [
    'documented: properties (in order) + timestamp + secret',
  ]);
  assert.deepEqual(matches(event, 'wrong-secret', documented), []);
});

test('variants are reported by name and the secret never appears in them', () => {
  const all = candidates(event, secret);
  assert.equal(Object.keys(all).length, 5);
  assert.ok(Object.values(all).every((value) => /^[0-9a-f]{64}$/.test(value) && !value.includes(secret)));
});
