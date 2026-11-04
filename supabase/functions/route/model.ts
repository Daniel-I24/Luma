import { isTravelMode, profileFor, type TravelMode } from './profiles.ts';

/** A point on the map. */
export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

export interface RouteInput {
  readonly from: LatLng;
  readonly to: LatLng;
  readonly mode: TravelMode;
}

/** What the app draws: the line ([lng, lat] pairs), meters and seconds. */
export interface Route {
  readonly line: readonly (readonly [number, number])[];
  readonly distanceM: number;
  readonly durationS: number;
  /** 'straight' when no provider answered: a line between both points and estimated time. */
  readonly source: string;
  /** The time is an adjustment of another profile (the moto uses the car's). */
  readonly approximate?: boolean;
  /** 'osm': the app shows "© OpenStreetMap" (the public OSM routing servers). */
  readonly attribution?: 'osm';
}

/** Cache cells of about 110 m: nearby requests share one provider call. */
const CELL_DECIMALS = 3;

/** The cache key material of a request: its cells and mode, never the exact points. */
export function cellOf(input: RouteInput): string {
  const cell = (p: LatLng) => `${p.lat.toFixed(CELL_DECIMALS)},${p.lng.toFixed(CELL_DECIMALS)}`;
  return `${cell(input.from)};${cell(input.to)};${input.mode}`;
}

/** Longer than this is not a pick-up route inside a town. */
const MAX_DISTANCE_M = 200_000;
/** Cache and privacy: about 11 m, enough for a route, never the exact position. */
const DECIMALS = 4;
const EARTH_RADIUS_M = 6_371_000;
const KMH_TO_MS = 1 / 3.6;
/** Streets are longer than the straight line. */
export const DETOUR_FACTOR = 1.3;

const round = (value: number) => Number(value.toFixed(DECIMALS));

function point(value: unknown): LatLng | null {
  if (typeof value !== 'object' || value === null) return null;
  const { lat, lng } = value as Record<string, unknown>;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: round(lat), lng: round(lng) };
}

/** Validates the request body; null when it is not a route request. */
export function parseInput(body: unknown): RouteInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = body as Record<string, unknown>;
  const from = point(raw.from);
  const to = point(raw.to);
  const mode = raw.mode ?? 'walk';
  if (!from || !to || !isTravelMode(mode)) return null;
  if (haversineM(from, to) > MAX_DISTANCE_M) return null;
  return { from, to, mode };
}

export function haversineM(a: LatLng, b: LatLng): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Without a provider: a straight line, its distance and an estimated time per mode (with a detour factor). */
export function straightRoute(input: RouteInput): Route {
  const distanceM = Math.round(haversineM(input.from, input.to) * DETOUR_FACTOR);
  return {
    line: [[input.from.lng, input.from.lat], [input.to.lng, input.to.lat]],
    distanceM,
    durationS: Math.round(distanceM / (profileFor(input.mode).straightKmh * KMH_TO_MS)),
    source: 'straight',
    ...(profileFor(input.mode).approximate ? { approximate: true } : {}),
  };
}
