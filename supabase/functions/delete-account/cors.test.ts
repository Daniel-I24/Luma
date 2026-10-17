import { assertEquals } from '@std/assert';

import { allowedOriginsFrom, corsHeaders, isOriginAllowed } from './cors.ts';

const RECOMMENDED = 'https://localhost, https://luma.vercel.app ,http://localhost:4200';

Deno.test('parses a comma-separated list, trimming and ignoring empty entries', () => {
  assertEquals(allowedOriginsFrom(` ${RECOMMENDED} ,, `), [
    'https://localhost',
    'https://luma.vercel.app',
    'http://localhost:4200',
  ]);
});

Deno.test('allows nothing when neither variable is set', () => {
  assertEquals(allowedOriginsFrom(undefined, undefined), []);
  assertEquals(allowedOriginsFrom('', '  '), []);
  assertEquals(isOriginAllowed('http://localhost:4200', allowedOriginsFrom(undefined)), false);
});

Deno.test('still accepts the legacy ALLOWED_ORIGIN, alone or merged without duplicates', () => {
  assertEquals(allowedOriginsFrom(undefined, 'https://luma.app'), ['https://luma.app']);
  assertEquals(allowedOriginsFrom('https://luma.app,https://localhost', 'https://luma.app'), [
    'https://luma.app',
    'https://localhost',
  ]);
});

Deno.test('ignores wildcard entries instead of treating them as patterns', () => {
  const allowed = allowedOriginsFrom('*, https://*.vercel.app, https://localhost');
  assertEquals(allowed, ['https://localhost']);
  assertEquals(isOriginAllowed('https://evil.vercel.app', allowed), false);
});

Deno.test('matches origins exactly (no prefix, suffix, case or port tolerance)', () => {
  const allowed = allowedOriginsFrom('https://luma.app');
  for (const origin of [
    'https://luma.app.evil.com',
    'https://evil-luma.app',
    'http://luma.app',
    'https://LUMA.app',
    'https://luma.app:8443',
    'https://luma.app/',
  ]) {
    assertEquals(isOriginAllowed(origin, allowed), false, origin);
  }
  assertEquals(isOriginAllowed('https://luma.app', allowed), true);
});

Deno.test('echoes only an allowed origin in the CORS headers', () => {
  const allowed = allowedOriginsFrom(RECOMMENDED);
  assertEquals(
    corsHeaders('https://localhost', allowed)['Access-Control-Allow-Origin'],
    'https://localhost',
  );
  assertEquals(
    corsHeaders('https://evil.example', allowed)['Access-Control-Allow-Origin'],
    undefined,
  );
  assertEquals(corsHeaders(null, allowed), { Vary: 'Origin' });
});
