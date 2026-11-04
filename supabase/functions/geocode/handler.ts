import { bearerToken, json, preflight, readJson, sha256 } from '../_shared/edge.ts';
import { finalizePlaces, MAX_CANDIDATES, parseInput, parseReverse, type Place, type Point } from './model.ts';
import type { GeocodeProvider } from './providers.ts';

/** What the function may do as the caller (their JWT). */
export interface CallerApi {
  /** consume_geocode_quota: false when a daily limit is reached. */
  consumeQuota(): Promise<boolean>;
}

export interface GeocodeDeps {
  readonly allowedOrigins: readonly string[];
  authenticate(token: string): Promise<CallerApi | null>;
  /** Server-only cache (service role). */
  readonly cache: {
    get(key: string): Promise<unknown>;
    put(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  };
  /** Null when the secrets are missing: the app searches businesses only. */
  readonly geocoder: GeocodeProvider | null;
}

/** Places change slowly; the database caps geocode keys at 7 days. */
export const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
/**
 * LocationIQ lets free accounts cache request-response pairs for up to 48
 * hours (locationiq.com/tos, "Acceptable Use"); paid accounts for as long as
 * they are customers. 48 hours is safe for both.
 */
const PROVIDER_CACHE_TTL_SECONDS: Readonly<Record<string, number>> = { locationiq: 48 * 60 * 60 };
/** Providers whose terms require a visible credit next to the results. */
const ATTRIBUTED_PROVIDERS = new Set(['locationiq']);

export function cacheTtlFor(provider: string): number {
  return PROVIDER_CACHE_TTL_SECONDS[provider] ?? CACHE_TTL_SECONDS;
}

export function createHandler(deps: GeocodeDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const checked = preflight(req, deps.allowedOrigins);
    if ('response' in checked) return checked.response;
    const { cors } = checked;
    const unavailable = () => json(503, { error: 'geocode_unavailable' }, cors);

    try {
      const body = await readJson(req);
      const point = parseReverse(body);
      const input = point ? null : parseInput(body);
      if (!point && !input) return json(400, { error: 'invalid_request' }, cors);
      const token = bearerToken(req);
      const caller = token ? await deps.authenticate(token) : null;
      if (!caller) return json(401, { error: 'unauthorized' }, cors);
      const geocoder = deps.geocoder;
      if (!geocoder || (point && !geocoder.reverse)) return unavailable();

      const material = JSON.stringify(point ? [geocoder.name, 'reverse', point] : [geocoder.name, input?.q.toLowerCase(), input?.near, input?.within]);
      const key = `geocode:${await sha256(material)}`;
      const cached = await deps.cache.get(key).catch(() => null);
      if (cached) return json(200, cached, cors);
      // The quota pays for provider calls only.
      if (!(await caller.consumeQuota())) return json(429, { error: 'quota_exceeded' }, cors);

      // The app shows "Search by LocationIQ.com" when attribution says so.
      const attribution = ATTRIBUTED_PROVIDERS.has(geocoder.name) ? geocoder.name : null;
      const result = point ? { ...(await reverse(geocoder, point)), attribution } : { places: await search(geocoder, input!), attribution };
      await deps.cache.put(key, result, cacheTtlFor(geocoder.name)).catch(() => undefined);
      return json(200, result, cors);
    } catch {
      return unavailable();
    }
  };
}

async function search(geocoder: GeocodeProvider, input: NonNullable<ReturnType<typeof parseInput>>): Promise<Place[]> {
  const places = finalizePlaces(await geocoder.search(input));
  return input.within ? places.slice(0, MAX_CANDIDATES) : places;
}

/** Always approximate: the owner edits it before saving. */
async function reverse(geocoder: GeocodeProvider, point: Point) {
  return { address: (await geocoder.reverse?.(point)) ?? null, approximate: true };
}
