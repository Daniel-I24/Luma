import { at, type FetchLike, getJson } from './http.ts';
import { cleanLabel, type Point, type ReverseAddress } from './model.ts';

const text = (value: unknown): string | null => (typeof value === 'string' ? cleanLabel([value]) : null);

/**
 * Reverse geocoding on a Nominatim-shaped API (LocationIQ /v1/reverse or
 * Nominatim /reverse): one call for the point the owner confirmed, building
 * level (zoom 18), Spanish, normalised address. The app shows the result as
 * an editable, approximate proposal.
 */
export async function reverseNominatimLike(
  options: { baseUrl: string; key?: string; headers: Record<string, string>; fetchFn: FetchLike },
  point: Point,
): Promise<ReverseAddress | null> {
  const params = new URLSearchParams({
    lat: String(point.lat), lon: String(point.lng), format: 'json', zoom: '18', addressdetails: '1',
    normalizeaddress: '1', 'accept-language': 'es',
  });
  if (options.key) params.set('key', options.key);
  const body = await getJson(options.fetchFn, `${options.baseUrl}/reverse?${params}`, options.headers);
  if (String(at(body, 'address', 'country_code')).toLowerCase() !== 'co') return null;
  const address = (key: string) => text(at(body, 'address', key));
  return {
    street: address('road'),
    houseNumber: address('house_number'),
    neighbourhood: address('neighbourhood') ?? address('suburb'),
    city: address('city') ?? address('town') ?? address('village'),
  };
}
