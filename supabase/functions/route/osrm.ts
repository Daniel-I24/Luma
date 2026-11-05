import { PUBLIC_OSRM_URL } from '../_shared/config/provider-urls.ts';
import type { Route, RouteInput } from './model.ts';
import { profileFor } from './profiles.ts';

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 6_000;
const MAX_POINTS = 2_000;
/** FOSSGIS: one request per second at most (routing.openstreetmap.de/about.html). */
export const OSRM_MIN_INTERVAL_MS = 1_000;

class OsrmFailure extends Error {}

/**
 * The public OpenStreetMap routing servers of FOSSGIS (OSRM, no key): an
 * identifying User-Agent, at most one request per second from this
 * function (a busy second falls through to the straight line), one try per
 * query. The app shows "© OpenStreetMap" with the route (attribution 'osm').
 */
export class PublicOsrm {
  public readonly name = 'osm-public';
  private readonly fetchFn: FetchLike;
  private readonly userAgent: string;
  private readonly now: () => number;
  private last = Number.NEGATIVE_INFINITY;

  constructor(options: { userAgent: string; fetchFn?: FetchLike; now?: () => number }) {
    this.userAgent = options.userAgent;
    this.fetchFn = options.fetchFn ?? ((url, init) => fetch(url, init));
    this.now = options.now ?? (() => Date.now());
  }

  /** One try; throws when busy, slow or wrong (the caller takes the next provider). */
  public async route(input: RouteInput): Promise<Route> {
    if (this.now() - this.last < OSRM_MIN_INTERVAL_MS) throw new OsrmFailure('busy');
    this.last = this.now();
    const profile = profileFor(input.mode);
    const points = `${input.from.lng},${input.from.lat};${input.to.lng},${input.to.lat}`;
    const url = `${PUBLIC_OSRM_URL}/routed-${profile.osrm}/route/v1/driving/${points}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await this.fetchFn(url, { method: 'GET', headers: { 'User-Agent': this.userAgent }, signal: controller.signal });
      if (!response.ok) {
        await response.body?.cancel();
        throw new OsrmFailure(`http_${response.status}`);
      }
      const route = parseOsrm(await response.json());
      if (!profile.approximate) return route;
      return { ...route, durationS: Math.round(route.durationS * profile.timeFactor), approximate: true };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** { code: 'Ok', routes[0]: { geometry: LineString, distance m, duration s } }. */
function parseOsrm(body: unknown): Route {
  const answer = body as { code?: unknown; routes?: { geometry?: { coordinates?: unknown }; distance?: unknown; duration?: unknown }[] };
  const first = answer?.routes?.[0];
  const coordinates = first?.geometry?.coordinates;
  const distance = Number(first?.distance);
  const duration = Number(first?.duration);
  if (answer?.code !== 'Ok' || !Array.isArray(coordinates) || coordinates.length < 2 || !Number.isFinite(distance) || !Number.isFinite(duration)) {
    throw new OsrmFailure('shape');
  }
  const line = coordinates.slice(0, MAX_POINTS).map((pair) => {
    if (!Array.isArray(pair) || typeof pair[0] !== 'number' || typeof pair[1] !== 'number') throw new OsrmFailure('shape');
    return [pair[0], pair[1]] as const;
  });
  return { line, distanceM: Math.round(distance), durationS: Math.round(duration), source: 'osm-public', attribution: 'osm' };
}
