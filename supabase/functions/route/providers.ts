import { OPENROUTESERVICE_DIRECTIONS_URL } from '../_shared/config/provider-urls.ts';
import type { Route, RouteInput } from './model.ts';
import { PublicOsrm } from './osrm.ts';
import { profileFor } from './profiles.ts';

/** Injectable fetch, so tests never reach the network. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** A routing service behind ROUTE_PROVIDER and ROUTE_API_KEY. */
export interface RoutingProvider {
  readonly name: string;
  route(input: RouteInput): Promise<Route>;
}

class RouteFailure extends Error {}

const ROUTE_TIMEOUT_MS = 6_000;
const ORS_URL = OPENROUTESERVICE_DIRECTIONS_URL;
const MAX_POINTS = 2_000;

/**
 * OpenRouteService Directions V2 (GeoJSON). Its standard plan allows 2000
 * directions a day and 40 a minute; the key stays on the server (HeiGIT:
 * "an API key must not be used client-side"). The key goes in the
 * Authorization header, never in a URL that could be logged.
 */
class OpenRouteService implements RoutingProvider {
  public readonly name = 'openrouteservice';

  constructor(private readonly apiKey: string, private readonly fetchFn: FetchLike = fetch) {}

  public async route(input: RouteInput): Promise<Route> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ROUTE_TIMEOUT_MS);
    try {
      const profile = profileFor(input.mode);
      const response = await this.fetchFn(`${ORS_URL}/${profile.ors}/geojson`, {
        method: 'POST',
        headers: { Authorization: this.apiKey, 'Content-Type': 'application/json', Accept: 'application/geo+json' },
        body: JSON.stringify({ coordinates: [[input.from.lng, input.from.lat], [input.to.lng, input.to.lat]] }),
        signal: controller.signal,
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new RouteFailure(`http_${response.status}`);
      }
      const route = parseOrs(await response.json());
      if (!profile.approximate) return route;
      return { ...route, durationS: Math.round(route.durationS * profile.timeFactor), approximate: true };
    } catch (error) {
      throw error instanceof RouteFailure ? error : new RouteFailure('network');
    } finally {
      clearTimeout(timer);
    }
  }
}

/** features[0]: geometry.coordinates ([lng, lat]) and properties.summary.{distance m, duration s}. */
export function parseOrs(body: unknown): Route {
  const feature = (body as { features?: unknown[] })?.features?.[0] as
    | { geometry?: { coordinates?: unknown }; properties?: { summary?: { distance?: unknown; duration?: unknown } } }
    | undefined;
  const coordinates = feature?.geometry?.coordinates;
  const distance = Number(feature?.properties?.summary?.distance);
  const duration = Number(feature?.properties?.summary?.duration);
  if (!Array.isArray(coordinates) || coordinates.length < 2 || !Number.isFinite(distance) || !Number.isFinite(duration)) {
    throw new RouteFailure('shape');
  }
  const line = coordinates.slice(0, MAX_POINTS).map((pair) => {
    if (!Array.isArray(pair) || typeof pair[0] !== 'number' || typeof pair[1] !== 'number') throw new RouteFailure('shape');
    return [pair[0], pair[1]] as const;
  });
  return { line, distanceM: Math.round(distance), durationS: Math.round(duration), source: 'openrouteservice' };
}

/** Tries each provider once, in order; the last failure is thrown (the handler draws the straight line). */
function chain(providers: readonly RoutingProvider[]): RoutingProvider | null {
  if (providers.length <= 1) return providers[0] ?? null;
  return {
    name: providers.map((p) => p.name).join('+'),
    route: async (input) => {
      let failure: unknown = new RouteFailure('none');
      for (const provider of providers) {
        try {
          return await provider.route(input);
        } catch (error) {
          failure = error;
        }
      }
      throw failure;
    },
  };
}

/**
 * The chain (docs/route.md): OpenRouteService with ROUTE_API_KEY, then the
 * public OSM servers of FOSSGIS (no key; ROUTE_PUBLIC_OSM=off turns them
 * off; ROUTE_CONTACT goes in the User-Agent), then the straight line.
 */
export function routerFromEnv(env: (name: string) => string | undefined, fetchFn: FetchLike = fetch): RoutingProvider | null {
  const provider = env('ROUTE_PROVIDER')?.trim().toLowerCase();
  const key = env('ROUTE_API_KEY')?.trim();
  const providers: RoutingProvider[] = [];
  if (key && (provider === 'openrouteservice' || !provider)) providers.push(new OpenRouteService(key, fetchFn));
  if (env('ROUTE_PUBLIC_OSM')?.trim().toLowerCase() !== 'off') {
    const contact = env('ROUTE_CONTACT')?.trim();
    providers.push(new PublicOsrm({ userAgent: contact ? `Luma/1.0 (${contact})` : 'Luma/1.0 (pick-up app, Pasto)', fetchFn }));
  }
  return chain(providers);
}
