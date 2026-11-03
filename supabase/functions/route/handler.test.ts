import { assertEquals, assertThrows } from '@std/assert';

import { CACHE_TTL_SECONDS, createHandler } from './handler.ts';
import { DETOUR_FACTOR, haversineM, parseInput, type Route, type RouteInput, straightRoute } from './model.ts';
import { parseOrs, routerFromEnv, type RoutingProvider } from './providers.ts';

const ORIGIN = 'http://localhost:4200';
const FROM = { lat: 1.2136, lng: -77.2811 };
const TO = { lat: 1.215, lng: -77.2795 };
const ROAD: Route = {
  line: [[-77.2811, 1.2136], [-77.28, 1.214], [-77.2795, 1.215]],
  distanceM: 320,
  durationS: 240,
  source: 'fake',
};

function setup(options: { quota?: boolean; cached?: unknown; router?: boolean; fails?: boolean } = {}) {
  const calls: RouteInput[] = [];
  const stored: [string, unknown, number][] = [];
  const router: RoutingProvider = {
    name: 'fake',
    route: (input) => {
      calls.push(input);
      return options.fails ? Promise.reject(new Error('down')) : Promise.resolve(ROAD);
    },
  };
  const handler = createHandler({
    allowedOrigins: [ORIGIN],
    authenticate: (token) =>
      Promise.resolve(token === 'good' ? { consumeQuota: () => Promise.resolve(options.quota ?? true) } : null),
    cache: {
      get: () => Promise.resolve(options.cached ?? null),
      put: (key, value, ttl) => Promise.resolve(void stored.push([key, value, ttl])),
    },
    router: options.router === false ? null : router,
  });
  return { handler, calls, stored };
}

const post = (body: unknown, token = 'good') =>
  new Request('http://localhost/functions/v1/route', {
    method: 'POST',
    headers: { Origin: ORIGIN, Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

Deno.test('draws the provider route and caches it for a day', async () => {
  const { handler, stored } = setup();
  const res = await handler(post({ from: FROM, to: TO, mode: 'walk' }));
  assertEquals([res.status, await res.json()], [200, ROAD]);
  assertEquals([stored[0][0].startsWith('route:'), stored[0][2]], [true, CACHE_TTL_SECONDS]);
});

Deno.test('needs a valid JWT and a valid request', async () => {
  const { handler, calls } = setup();
  assertEquals((await handler(post({ from: FROM, to: TO }, 'bad'))).status, 401);
  assertEquals((await handler(post({ from: FROM }))).status, 400);
  assertEquals((await handler(post({ from: FROM, to: { lat: 4.6, lng: -74.08 } }))).status, 400);
  assertEquals(calls.length, 0);
});

Deno.test('without a key, with a failing provider or with the quota used: the straight line', async () => {
  for (const options of [{ router: false }, { fails: true }, { quota: false }]) {
    const { handler } = setup(options);
    const body = await (await handler(post({ from: FROM, to: TO, mode: 'drive' }))).json();
    assertEquals([body.source, body.line.length, body.distanceM > 0, body.durationS > 0], ['straight', 2, true, true]);
  }
});

Deno.test('a cached route spends no quota and calls no provider', async () => {
  const { handler, calls } = setup({ cached: ROAD, quota: false });
  assertEquals(await (await handler(post({ from: FROM, to: TO }))).json(), ROAD);
  assertEquals(calls.length, 0);
});

Deno.test('the estimate: haversine times a detour factor at walking speed; positions are rounded', () => {
  const route = straightRoute(parseInput({ from: FROM, to: TO })!);
  assertEquals(route.distanceM, Math.round(haversineM(FROM, TO) * DETOUR_FACTOR));
  assertEquals(route.durationS, Math.round(route.distanceM / (4.8 / 3.6)));
  assertEquals(parseInput({ from: { lat: 1.21361234, lng: -77.28119 }, to: TO })?.from, { lat: 1.2136, lng: -77.2812 });
});

Deno.test('OpenRouteService: GeoJSON summary and line, the key only in a header (fetch simulated)', async () => {
  const seen: { url: string; init: RequestInit }[] = [];
  const fetchFn = (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return Promise.resolve(Response.json({
      features: [{
        geometry: { coordinates: [[-77.2811, 1.2136], [-77.2795, 1.215]] },
        properties: { summary: { distance: 321.4, duration: 250.6 } },
      }],
    }));
  };
  const env: Record<string, string> = { ROUTE_PROVIDER: 'openrouteservice', ROUTE_API_KEY: 'k-123' };
  const router = routerFromEnv((name) => env[name], fetchFn)!;
  const route = await router.route(parseInput({ from: FROM, to: TO, mode: 'walk' })!);
  assertEquals([route.distanceM, route.durationS, route.line.length], [321, 251, 2]);
  assertEquals(seen[0].url, 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson');
  assertEquals((seen[0].init.headers as Record<string, string>).Authorization, 'k-123');
  assertEquals(seen[0].url.includes('k-123'), false);
  assertEquals(routerFromEnv(() => undefined), null);
});

Deno.test('OpenRouteService: an unexpected shape is a failure, not a broken route', () => {
  assertThrows(() => parseOrs({ features: [{ geometry: { coordinates: [[1]] } }] }));
});
