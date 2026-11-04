import { assertEquals, assertRejects } from '@std/assert';

import { cellOf, parseInput } from './model.ts';
import { OSRM_MIN_INTERVAL_MS, PublicOsrm } from './osrm.ts';
import { routerFromEnv } from './providers.ts';

const INPUT = parseInput({ from: { lat: 1.2136, lng: -77.2811 }, to: { lat: 1.2005, lng: -77.2602 }, mode: 'moto' })!;
const OSRM_OK = { code: 'Ok', routes: [{ distance: 3580.9, duration: 349.6, geometry: { type: 'LineString', coordinates: [[-77.2811, 1.2136], [-77.2602, 1.2005]] } }] };

function recorder(...answers: (number | unknown)[]) {
  const seen: { url: string; headers: Record<string, string> }[] = [];
  const fetchFn = (url: string, init: RequestInit) => {
    seen.push({ url, headers: init.headers as Record<string, string> });
    const next = answers.shift();
    return Promise.resolve(typeof next === 'number' ? new Response('{}', { status: next }) : new Response(JSON.stringify(next)));
  };
  return { fetchFn, seen };
}

Deno.test('public OSM: FOSSGIS car server for the moto (approximate time), own User-Agent, OSM attribution', async () => {
  const { fetchFn, seen } = recorder(OSRM_OK);
  const route = await new PublicOsrm({ userAgent: 'Luma/1.0 (ops@example.com)', fetchFn }).route(INPUT);
  assertEquals(seen[0]?.url, 'https://routing.openstreetmap.de/routed-car/route/v1/driving/-77.2811,1.2136;-77.2602,1.2005?overview=full&geometries=geojson');
  assertEquals(seen[0]?.headers['User-Agent'], 'Luma/1.0 (ops@example.com)');
  assertEquals([route.distanceM, route.durationS, route.approximate, route.attribution, route.source], [3581, 280, true, 'osm', 'osm-public']);
});

Deno.test('public OSM: at most one request per second, one try per query', async () => {
  let now = 0;
  const { fetchFn, seen } = recorder(OSRM_OK, 502);
  const osm = new PublicOsrm({ userAgent: 'Luma/1.0', fetchFn, now: () => now });
  await osm.route(INPUT);
  await assertRejects(() => osm.route(INPUT));
  assertEquals(seen.length, 1, 'the busy second never reaches the server');
  now += OSRM_MIN_INTERVAL_MS;
  await assertRejects(() => osm.route(INPUT));
  assertEquals(seen.length, 2, 'a 502 is not retried');
});

Deno.test('chain: OpenRouteService with a key first, then public OSM; each tried once', async () => {
  const { fetchFn, seen } = recorder(503, OSRM_OK);
  const router = routerFromEnv((name) => ({ ROUTE_API_KEY: 'k' })[name], fetchFn)!;
  const route = await router.route(INPUT);
  assertEquals(seen.map((s) => new URL(s.url).hostname), ['api.openrouteservice.org', 'routing.openstreetmap.de']);
  assertEquals(route.source, 'osm-public');
  const keyless = routerFromEnv(() => undefined, recorder(500).fetchFn)!;
  await assertRejects(() => keyless.route(INPUT), Error);
});

Deno.test('cache cells of about 110 m: nearby requests share a key, the exact point never goes in it', () => {
  const near = parseInput({ from: { lat: 1.21362, lng: -77.28108 }, to: { lat: 1.2005, lng: -77.2602 }, mode: 'moto' })!;
  assertEquals(cellOf(INPUT), cellOf(near));
  assertEquals(cellOf(INPUT), '1.214,-77.281;1.200,-77.260;moto');
});
