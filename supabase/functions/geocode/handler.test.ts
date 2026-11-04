import { assertEquals } from '@std/assert';

import { CACHE_TTL_SECONDS, cacheTtlFor, createHandler } from './handler.ts';
import { type GeocodeInput, parseInput, type Place, PASTO } from './model.ts';
import type { GeocodeProvider } from './providers.ts';
import { at } from '../_shared/testing.ts';

const ORIGIN = 'http://localhost:4200';
const CENTRO: Place = { label: 'Centro, Pasto', kind: 'neighbourhood', lat: 1.214, lng: -77.281 };

function setup(options: { quota?: boolean; cached?: unknown; geocoder?: boolean; fails?: boolean; name?: string } = {}) {
  const searches: GeocodeInput[] = [];
  const stored: [string, unknown, number][] = [];
  const geocoder: GeocodeProvider = {
    name: options.name ?? 'fake',
    search: (input) => {
      searches.push(input);
      return options.fails ? Promise.reject(new Error('down')) : Promise.resolve([CENTRO, null]);
    },
  };
  const handler = createHandler({
    allowedOrigins: [ORIGIN],
    authenticate: (token) => Promise.resolve(token === 'good' ? { consumeQuota: () => Promise.resolve(options.quota ?? true) } : null),
    cache: {
      get: () => Promise.resolve(options.cached ?? null),
      put: (key, value, ttl) => Promise.resolve(void stored.push([key, value, ttl])),
    },
    geocoder: options.geocoder === false ? null : geocoder,
  });
  return { handler, searches, stored };
}

const post = (body: unknown, token = 'good') =>
  new Request('http://localhost/functions/v1/geocode', {
    method: 'POST',
    headers: { Origin: ORIGIN, Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

Deno.test('finds places and caches them for 7 days', async () => {
  const { handler, stored } = setup();
  const res = await handler(post({ q: '  centro   pasto ' }));
  assertEquals([res.status, await res.json()], [200, { places: [CENTRO], attribution: null }]);
  assertEquals(at(stored, 0)[0]?.startsWith('geocode:'), true);
  assertEquals(at(stored, 0)[2], CACHE_TTL_SECONDS);
});

Deno.test('the provider gets a rounded bias inside Colombia, Pasto otherwise', () => {
  assertEquals(parseInput({ q: 'centro', near: { lat: 4.60971, lng: -74.08175 } })?.near, { lat: 4.61, lng: -74.08 });
  assertEquals(parseInput({ q: 'centro', near: { lat: 40.4, lng: -3.7 } })?.near, PASTO);
  assertEquals(parseInput({ q: 'centro\u0000‮' })?.q, 'centro');
  assertEquals(parseInput({ q: 'x' }), null);
  assertEquals(parseInput({ q: 'x'.repeat(121) }), null);
});

Deno.test('a cached answer spends no quota and skips the provider', async () => {
  const { handler, searches } = setup({ cached: { places: [] }, quota: false });
  assertEquals((await handler(post({ q: 'centro' }))).status, 200);
  assertEquals(searches.length, 0);
});

Deno.test('quota 429, no session 401, bad body 400, no provider or a failure 503', async () => {
  assertEquals((await setup({ quota: false }).handler(post({ q: 'centro' }))).status, 429);
  assertEquals((await setup().handler(post({ q: 'centro' }, 'bad'))).status, 401);
  assertEquals((await setup().handler(post({ query: 'centro' }))).status, 400);
  const none = await setup({ geocoder: false }).handler(post({ q: 'centro' }));
  assertEquals([none.status, await none.json()], [503, { error: 'geocode_unavailable' }]);
  assertEquals((await setup({ fails: true }).handler(post({ q: 'centro' }))).status, 503);
});

Deno.test('LocationIQ answers are cached 48 hours (its terms) and carry its attribution', async () => {
  const { handler, stored } = setup({ name: 'locationiq' });
  const res = await handler(post({ q: 'centro pasto' }));
  assertEquals((await res.json()).attribution, 'locationiq');
  assertEquals(at(stored, 0)[2], 48 * 60 * 60);
  assertEquals([cacheTtlFor('photon'), cacheTtlFor('locationiq')], [CACHE_TTL_SECONDS, 172800]);
});
