import { at, type FetchLike, getJson, num } from './http.ts';
import { cleanLabel, COLOMBIA_BBOX, type GeocodeInput, MAX_PLACES, NARINO_BBOX, type Place, type PlaceKind } from './model.ts';
import { LOCATIONIQ_BASE_URL, MAPTILER_BASE_URL, NOMINATIM_BASE_URL, PHOTON_BASE_URL } from '../_shared/config/provider-urls.ts';

export interface GeocodeProvider {
  readonly name: string;
  search(input: GeocodeInput): Promise<(Place | null)[]>;
}

const fetchOf = (fetchFn?: FetchLike): FetchLike => fetchFn ?? ((url, init) => fetch(url, init));

function kindOf(type: unknown): PlaceKind {
  switch (type) {
    case 'house': case 'building': case 'address': case 'housenumber':
      return 'address';
    case 'street': case 'road':
      return 'street';
    case 'district': case 'locality': case 'neighbourhood': case 'suburb': case 'quarter':
    case 'city_district': case 'subcity':
      return 'neighbourhood';
    case 'city': case 'town': case 'village': case 'municipality': case 'place':
      return 'city';
    default:
      return 'poi';
  }
}

const place = (label: string | null, kind: PlaceKind, lat: number, lng: number): Place | null =>
  label ? { label, kind, lat, lng } : null;

/**
 * Photon (photon.komoot.io, OpenStreetMap, no key; fair use only). Bias by
 * lat/lon, restricted to Colombia by bbox and by countrycode.
 */
export function createPhoton(fetchFn?: FetchLike, baseUrl = PHOTON_BASE_URL): GeocodeProvider {
  return {
    name: 'photon',
    search: async ({ q, near }) => {
      const params = new URLSearchParams({
        q, lat: String(near.lat), lon: String(near.lng), limit: String(MAX_PLACES), bbox: COLOMBIA_BBOX.join(','),
      });
      const body = await getJson(fetchOf(fetchFn), `${baseUrl}/api/?${params}`);
      const features = at(body, 'features');
      return (Array.isArray(features) ? features : []).map((f) => {
        const p = at(f, 'properties');
        if (String(at(p, 'countrycode')).toUpperCase() !== 'CO') return null;
        const street = [at(p, 'street'), at(p, 'housenumber')].filter((x) => typeof x === 'string').join(' ');
        const label = cleanLabel([at(p, 'name'), street, at(p, 'district'), at(p, 'city'), at(p, 'state')]);
        return place(label, kindOf(at(p, 'type')), num(at(f, 'geometry', 'coordinates', 1)), num(at(f, 'geometry', 'coordinates', 0)));
      });
    },
  };
}

/**
 * Nominatim-shaped APIs: nominatim.openstreetmap.org (no key; at most 1
 * request per second, an identifying User-Agent, no autocomplete) and
 * LocationIQ (key). Colombia only, Spanish, Nariño preferred.
 */
export function createNominatimLike(options: {
  name: 'nominatim' | 'locationiq';
  baseUrl: string;
  key?: string;
  userAgent?: string;
  fetchFn?: FetchLike;
}): GeocodeProvider {
  return {
    name: options.name,
    search: async ({ q }) => {
      const params = new URLSearchParams({
        q, format: 'json', countrycodes: 'co', 'accept-language': 'es', limit: String(MAX_PLACES),
        addressdetails: '1', viewbox: NARINO_BBOX.join(','), bounded: '0',
      });
      if (options.key) params.set('key', options.key);
      const headers: Record<string, string> = options.userAgent ? { 'User-Agent': options.userAgent } : {};
      const body = await getJson(fetchOf(options.fetchFn), `${options.baseUrl}/search?${params}`, headers);
      return (Array.isArray(body) ? body : []).map((r) => {
        if (String(at(r, 'address', 'country_code')).toLowerCase() !== 'co') return null;
        const label = cleanLabel(String(at(r, 'display_name') ?? '').split(',').slice(0, 4));
        return place(label, kindOf(at(r, 'addresstype') ?? at(r, 'type')), num(at(r, 'lat')), num(at(r, 'lon')));
      });
    },
  };
}

/** MapTiler Geocoding (key). Colombia only, Spanish, proximity to the bias point. */
export function createMapTiler(key: string, fetchFn?: FetchLike, baseUrl = MAPTILER_BASE_URL): GeocodeProvider {
  return {
    name: 'maptiler',
    search: async ({ q, near }) => {
      const params = new URLSearchParams({
        key, country: 'co', language: 'es', limit: String(MAX_PLACES), proximity: `${near.lng},${near.lat}`,
      });
      const body = await getJson(fetchOf(fetchFn), `${baseUrl}/geocoding/${encodeURIComponent(q)}.json?${params}`);
      const features = at(body, 'features');
      return (Array.isArray(features) ? features : []).map((f) =>
        place(
          cleanLabel(String(at(f, 'place_name') ?? '').split(',').slice(0, 4)),
          kindOf(at(f, 'place_type', 0)),
          num(at(f, 'center', 1)),
          num(at(f, 'center', 0)),
        ));
    },
  };
}

/**
 * GEOCODE_PROVIDER (photon | nominatim | locationiq | maptiler),
 * GEOCODE_API_KEY (locationiq, maptiler), GEOCODE_CONTACT (nominatim: an
 * email or URL for the User-Agent, required by its policy). Null when
 * anything is missing: the function answers geocode_unavailable and the
 * app searches businesses only.
 */
export function geocoderFromEnv(get: (name: string) => string | undefined, fetchFn?: FetchLike): GeocodeProvider | null {
  const name = get('GEOCODE_PROVIDER')?.trim().toLowerCase();
  const key = get('GEOCODE_API_KEY')?.trim();
  const contact = get('GEOCODE_CONTACT')?.trim();
  switch (name) {
    case 'photon':
      return createPhoton(fetchFn);
    case 'nominatim':
      return contact
        ? createNominatimLike({ name, baseUrl: NOMINATIM_BASE_URL, userAgent: `Luma/1.0 (${contact})`, fetchFn })
        : null;
    case 'locationiq':
      return key ? createNominatimLike({ name, baseUrl: LOCATIONIQ_BASE_URL, key, fetchFn }) : null;
    case 'maptiler':
      return key ? createMapTiler(key, fetchFn) : null;
    default:
      return null;
  }
}
