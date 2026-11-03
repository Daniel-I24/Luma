import { assertEquals } from '@std/assert';

import type { FetchLike } from './http.ts';
import { finalizePlaces, PASTO } from './model.ts';
import { createMapTiler, createNominatimLike, createPhoton, geocoderFromEnv } from './providers.ts';

function recorder(answer: unknown, status = 200) {
  const calls: { url: URL; headers: Record<string, string> }[] = [];
  const fetchFn: FetchLike = (url, init) => {
    calls.push({ url: new URL(url), headers: (init.headers ?? {}) as Record<string, string> });
    return Promise.resolve(new Response(JSON.stringify(answer), { status }));
  };
  return { fetchFn, calls };
}

const input = { q: 'Barrio San Ignacio', near: PASTO };

Deno.test('photon: bias to the point, Colombia bbox, foreign results dropped', async () => {
  const { fetchFn, calls } = recorder({
    features: [
      { geometry: { coordinates: [-77.28, 1.21] }, properties: { name: 'San Ignacio', type: 'district', city: 'Pasto', countrycode: 'CO' } },
      { geometry: { coordinates: [-78.5, -0.2] }, properties: { name: 'San Ignacio', type: 'district', countrycode: 'EC' } },
    ],
  });
  const places = finalizePlaces(await createPhoton(fetchFn).search(input));
  assertEquals(places, [{ label: 'San Ignacio, Pasto', kind: 'neighbourhood', lat: 1.21, lng: -77.28 }]);
  assertEquals([calls[0].url.searchParams.get('lat'), calls[0].url.searchParams.get('bbox')], ['1.2136', '-81.8,-4.3,-66.8,13.6']);
});

Deno.test('nominatim: Colombia only, Spanish, Nariño view box and an identifying User-Agent', async () => {
  const { fetchFn, calls } = recorder([
    { lat: '1.2153', lon: '-77.2790', display_name: 'Calle 18, Centro, Pasto, Nariño, Colombia', addresstype: 'road', address: { country_code: 'co' } },
  ]);
  const provider = geocoderFromEnv((n) => ({ GEOCODE_PROVIDER: 'nominatim', GEOCODE_CONTACT: 'ops@example.com' })[n], fetchFn);
  const places = finalizePlaces(await provider!.search(input));
  assertEquals(places, [{ label: 'Calle 18, Centro, Pasto, Nariño', kind: 'street', lat: 1.2153, lng: -77.279 }]);
  const params = calls[0].url.searchParams;
  assertEquals([params.get('countrycodes'), params.get('accept-language'), params.get('viewbox')], ['co', 'es', '-79.1,0.3,-76.8,2.7']);
  assertEquals(calls[0].headers['User-Agent'], 'Luma/1.0 (ops@example.com)');
});

Deno.test('locationiq sends its key; maptiler uses country, language and proximity', async () => {
  const iq = recorder([]);
  await createNominatimLike({ name: 'locationiq', baseUrl: 'https://x.test/v1', key: 'k1', fetchFn: iq.fetchFn }).search(input);
  assertEquals(iq.calls[0].url.searchParams.get('key'), 'k1');

  const mt = recorder({ features: [{ place_name: 'Unicentro, Pasto, Nariño, Colombia', place_type: ['poi'], center: [-77.27, 1.22] }] });
  const places = finalizePlaces(await createMapTiler('k2', mt.fetchFn).search(input));
  assertEquals(places, [{ label: 'Unicentro, Pasto, Nariño, Colombia', kind: 'poi', lat: 1.22, lng: -77.27 }]);
  const params = mt.calls[0].url.searchParams;
  assertEquals([params.get('country'), params.get('language'), params.get('proximity')], ['co', 'es', '-77.2811,1.2136']);
  assertEquals(mt.calls[0].url.pathname, '/geocoding/Barrio%20San%20Ignacio.json');
});

Deno.test('missing secrets give no provider', () => {
  const env = (vars: Record<string, string>) => (n: string) => vars[n];
  assertEquals(geocoderFromEnv(env({})), null);
  assertEquals(geocoderFromEnv(env({ GEOCODE_PROVIDER: 'nominatim' })), null);
  assertEquals(geocoderFromEnv(env({ GEOCODE_PROVIDER: 'maptiler' })), null);
  assertEquals(geocoderFromEnv(env({ GEOCODE_PROVIDER: 'other', GEOCODE_API_KEY: 'k' })), null);
  assertEquals(geocoderFromEnv(env({ GEOCODE_PROVIDER: 'photon' }))?.name, 'photon');
});

Deno.test('labels are plain text, places are unique and capped at 8', () => {
  const many = Array.from({ length: 12 }, (_, n) => ({ label: `P${n % 10}`, kind: 'poi' as const, lat: 1.2, lng: -77.2 }));
  assertEquals(finalizePlaces([...many, null]).length, 8);
  assertEquals(finalizePlaces([{ label: 'Lejos', kind: 'poi', lat: 40, lng: -3 }]), []);
});
