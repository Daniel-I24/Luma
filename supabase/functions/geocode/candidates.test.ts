import { assertEquals } from '@std/assert';

import { createHandler } from './handler.ts';
import type { FetchLike } from './http.ts';
import { finalizePlaces, parseInput, parseReverse, PASTO, viewboxAround } from './model.ts';
import { createNominatimLike } from './providers.ts';
import { at } from '../_shared/testing.ts';

const ORIGIN = 'http://localhost:4200';

function recorder(answer: unknown) {
  const urls: URL[] = [];
  const fetchFn: FetchLike = (url) => {
    urls.push(new URL(url));
    return Promise.resolve(new Response(JSON.stringify(answer)));
  };
  return { fetchFn, urls };
}

const locationIq = (fetchFn: FetchLike) =>
  createNominatimLike({ name: 'locationiq', baseUrl: 'https://us1.locationiq.com/v1', key: 'k', fetchFn });

Deno.test('a search within a municipality is bounded to its box, 5 candidates, deduplicated', async () => {
  const { fetchFn, urls } = recorder([
    // What LocationIQ answered for "Jamondino": the point lies in another suburb ("Centro").
    { lat: '1.2310', lon: '-77.2920', display_name: 'Jamondino, Centro, Pasto, Nariño, Colombia', type: 'suburb', address: { country_code: 'co', suburb: 'Centro', city: 'Pasto' } },
  ]);
  const input = parseInput({ q: 'Jamondino', near: PASTO, within: { lat: 1.2136, lng: -77.2811, radiusKm: 15 } })!;
  const places = finalizePlaces(await locationIq(fetchFn).search(input));
  assertEquals(at(places, 0).label, 'Jamondino, Pasto');
  const params = at(urls, 0).searchParams;
  assertEquals([params.get('bounded'), params.get('limit'), params.get('dedupe'), params.get('addressdetails')], ['1', '5', '1', '1']);
  const [minLng, minLat, maxLng, maxLat] = viewboxAround(input.within!);
  assertEquals(params.get('viewbox'), [minLng, minLat, maxLng, maxLat].join(','));
  assertEquals(Math.round((maxLat - minLat) * 111.32), 30);
});

Deno.test('reverse: one call for the confirmed point, normalised Spanish address', async () => {
  const { fetchFn, urls } = recorder({
    address: { country_code: 'co', road: 'Calle 22', house_number: '14-30', suburb: 'Jamondino', city: 'Pasto' },
  });
  const address = await locationIq(fetchFn).reverse!({ lat: 1.2001, lng: -77.2602 });
  assertEquals(address, { street: 'Calle 22', houseNumber: '14-30', neighbourhood: 'Jamondino', city: 'Pasto' });
  const params = at(urls, 0).searchParams;
  assertEquals([at(urls, 0).pathname, params.get('zoom'), params.get('normalizeaddress')], ['/v1/reverse', '18', '1']);
});

Deno.test('the function answers a reverse request as approximate, and refuses points outside Colombia', async () => {
  assertEquals(parseReverse({ reverse: { lat: 40, lng: -3 } }), null);
  const { fetchFn } = recorder({ address: { country_code: 'co', road: 'Calle 22', city: 'Pasto' } });
  const handler = createHandler({
    allowedOrigins: [ORIGIN],
    authenticate: () => Promise.resolve({ consumeQuota: () => Promise.resolve(true) }),
    cache: { get: () => Promise.resolve(null), put: () => Promise.resolve() },
    geocoder: locationIq(fetchFn),
  });
  const response = await handler(new Request('http://localhost/functions/v1/geocode', {
    method: 'POST',
    headers: { Origin: ORIGIN, Authorization: 'Bearer good' },
    body: JSON.stringify({ reverse: { lat: 1.20012345, lng: -77.26 } }),
  }));
  const body = await response.json();
  assertEquals([response.status, body.approximate, body.address.street, body.attribution], [200, true, 'Calle 22', 'locationiq']);
});
