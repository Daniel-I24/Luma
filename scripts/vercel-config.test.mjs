import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const headersOf = (source) =>
  Object.fromEntries((vercel.headers.find((h) => h.source === source)?.headers ?? []).map((h) => [h.key, h.value]));

test('every page gets a strict CSP and the security headers', () => {
  const all = headersOf('/(.*)');
  const csp = all['Content-Security-Policy'];
  for (const directive of [
    "default-src 'self'",
    "script-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    'upgrade-insecure-requests',
  ]) {
    assert.ok(csp.includes(directive), directive);
  }
  assert.ok(!/script-src[^;]*unsafe-(inline|eval)/.test(csp), 'no unsafe scripts');
  assert.match(csp, /connect-src 'self' https:\/\/\*\.supabase\.co/);
  assert.equal(all['X-Content-Type-Options'], 'nosniff');
  assert.equal(all['X-Frame-Options'], 'DENY');
  assert.equal(all['Cross-Origin-Opener-Policy'], 'same-origin');
  assert.match(all['Strict-Transport-Security'], /max-age=\d{8}/);
  assert.match(all['Permissions-Policy'], /camera=\(\)/);
});

test('version.json is never cached and the APK may read it', () => {
  const version = headersOf('/version.json');
  assert.equal(version['Cache-Control'], 'no-store');
  assert.equal(version['Access-Control-Allow-Origin'], '*');
});
