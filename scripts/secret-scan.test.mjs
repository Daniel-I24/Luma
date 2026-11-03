import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forbiddenFile, jwtRole, scan, scanText } from './secret-scan.mjs';

const jwt = (payload) =>
  ['{"alg":"HS256"}', JSON.stringify(payload)].map((p) => Buffer.from(p).toString('base64url')).concat('c2lnbmF0dXJlLXNpZ25hdHVyZQ').join('.');

test('only service_role JWTs are secrets (anon keys are public)', () => {
  assert.equal(jwtRole(jwt({ role: 'service_role' })), 'service_role');
  assert.deepEqual(scanText(`key = "${jwt({ role: 'anon' })}"`), []);
  assert.deepEqual(scanText(`\nkey = "${jwt({ role: 'service_role' })}"`), [{ line: 2, kind: 'service_role JWT' }]);
});

test('finds private keys and provider API keys, never echoing them', () => {
  const kinds = scanText(
    [
      '-----BEGIN PRIVATE KEY-----',
      'sb_secret_abcdefghijklmnop',
      `AIza${'x'.repeat(35)}`,
      `sk-ant-${'a'.repeat(30)}`,
      `ghp_${'a'.repeat(36)}`,
      'nothing here',
    ].join('\n'),
  ).map((f) => f.kind);
  assert.deepEqual(kinds, ['private key', 'Supabase secret key', 'Google API key', 'Anthropic API key', 'GitHub token']);
});

test('some files must never be tracked', () => {
  for (const path of ['android/app/google-services.json', 'release.jks', 'demo.p12', 'src/environments/environment.ts', '.env', 'x/my-service-account.json']) {
    assert.ok(forbiddenFile(path), path);
  }
  for (const path of ['src/environments/environment.example.ts', 'src/environments/environment.prod.ts', 'package.json']) {
    assert.equal(forbiddenFile(path), null, path);
  }
});

test('scan reports file and line only', () => {
  const problems = scan(['a.ts', 'b.jks'], () => `ok\nsb_secret_${'z'.repeat(20)}`);
  assert.deepEqual(problems, ['a.ts:2: Supabase secret key', 'b.jks: keystore must not be committed']);
});
