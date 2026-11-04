import { bearerToken, json, preflight, readJson, sha256 } from '../_shared/edge.ts';
import { cellOf, parseInput, type Route, straightRoute } from './model.ts';
import type { RoutingProvider } from './providers.ts';

/** What the function may do as the caller (their JWT). */
export interface CallerApi {
  /** hit_rate_limit('route'): false once the daily quota of the user is used. */
  consumeQuota(): Promise<boolean>;
}

export interface RouteDeps {
  readonly allowedOrigins: readonly string[];
  authenticate(token: string): Promise<CallerApi | null>;
  /** Server-only cache (service role). */
  readonly cache: {
    get(key: string): Promise<unknown>;
    put(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  };
  /** Null when every provider is off: the app gets the straight-line estimate. */
  readonly router: RoutingProvider | null;
}

/** Streets change slowly; the database caps non-geocode cache keys at one day. */
export const CACHE_TTL_SECONDS = 24 * 60 * 60;

/**
 * route — the way from the customer to a business: JWT required; the
 * straight-line estimate without a provider or when it fails (never an
 * error screen for a nicety); provider answers are cached and only they
 * use the user's daily quota.
 */
export function createHandler(deps: RouteDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const checked = preflight(req, deps.allowedOrigins);
    if ('response' in checked) return checked.response;
    const { cors } = checked;
    try {
      const input = parseInput(await readJson(req));
      if (!input) return json(400, { error: 'invalid_request' }, cors);
      const token = bearerToken(req);
      const caller = token ? await deps.authenticate(token) : null;
      if (!caller) return json(401, { error: 'unauthorized' }, cors);
      if (!deps.router) return json(200, straightRoute(input), cors);

      const key = `route:${await sha256(JSON.stringify([deps.router.name, cellOf(input)]))}`;
      const cached = await deps.cache.get(key).catch(() => null);
      if (cached) return json(200, cached, cors);
      if (!(await caller.consumeQuota())) return json(200, { ...straightRoute(input), limited: true }, cors);
      let route: Route;
      try {
        route = await deps.router.route(input);
      } catch {
        return json(200, straightRoute(input), cors);
      }
      await deps.cache.put(key, route, CACHE_TTL_SECONDS).catch(() => undefined);
      return json(200, route, cors);
    } catch {
      return json(503, { error: 'route_unavailable' }, cors);
    }
  };
}
