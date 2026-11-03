import { bearerToken, json, preflight, readJson, sha256 } from '../_shared/edge.ts';
import { finalizePlaces, parseInput, type Place } from './model.ts';
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

export function createHandler(deps: GeocodeDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const checked = preflight(req, deps.allowedOrigins);
    if ('response' in checked) return checked.response;
    const { cors } = checked;
    const unavailable = () => json(503, { error: 'geocode_unavailable' }, cors);

    try {
      const input = parseInput(await readJson(req));
      if (!input) return json(400, { error: 'invalid_request' }, cors);
      const token = bearerToken(req);
      const caller = token ? await deps.authenticate(token) : null;
      if (!caller) return json(401, { error: 'unauthorized' }, cors);
      if (!deps.geocoder) return unavailable();

      const material = JSON.stringify([deps.geocoder.name, input.q.toLowerCase(), input.near.lat, input.near.lng]);
      const key = `geocode:${await sha256(material)}`;
      const cached = await deps.cache.get(key).catch(() => null);
      if (cached) return json(200, cached, cors);
      // The quota pays for provider calls only.
      if (!(await caller.consumeQuota())) return json(429, { error: 'quota_exceeded' }, cors);

      const places: Place[] = finalizePlaces(await deps.geocoder.search(input));
      const result = { places };
      await deps.cache.put(key, result, CACHE_TTL_SECONDS).catch(() => undefined);
      return json(200, result, cors);
    } catch {
      return unavailable();
    }
  };
}
