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
  assert.match(csp, /img-src [^;]*blob:/, 'the preview of a photo before uploading it');
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

test('the public legal pages: short URLs before the SPA fallback, no session needed', () => {
  const sources = vercel.rewrites.map((r) => r.source);
  for (const slug of ['terminos', 'privacidad', 'reembolsos', 'eliminacion-datos']) {
    const rewrite = vercel.rewrites.find((r) => r.source === `/${slug}`);
    assert.equal(rewrite?.destination, `/legal/${slug}.html`);
    assert.ok(sources.indexOf(`/${slug}`) < sources.indexOf('/(.*)'), `${slug} before the SPA`);
  }
  assert.equal(vercel.rewrites.at(-1).destination, '/index.html');
  // The index, and the relative links of a page opened by its short URL.
  assert.ok(sources.indexOf('/legal') < sources.indexOf('/(.*)'));
  assert.equal(vercel.rewrites.find((r) => r.source === '/legal').destination, '/legal/index.html');
  const pages = vercel.rewrites.find((r) => r.destination === '/legal/:page.html');
  assert.equal(pages.source, '/:page(terminos|privacidad|reembolsos|eliminacion-datos).html');
  assert.ok(sources.indexOf(pages.source) < sources.indexOf('/(.*)'));
  const csp = headersOf('/(.*)')['Content-Security-Policy'];
  assert.match(csp, /style-src [^;]*'unsafe-inline'/, 'the inline style of the legal pages');
});
