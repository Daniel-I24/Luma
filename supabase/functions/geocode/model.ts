/** What the map search shows for a neighbourhood, an address or a place. */
const PLACE_KINDS = ['address', 'street', 'neighbourhood', 'city', 'poi'] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export interface Place {
  readonly label: string;
  readonly kind: PlaceKind;
  readonly lat: number;
  readonly lng: number;
}

export interface Point {
  readonly lat: number;
  readonly lng: number;
}

/** The municipality the owner chose (DANE centre): candidates must fall around it. */
export interface Within {
  readonly centre: Point;
  readonly radiusKm: number;
}

export interface GeocodeInput {
  /** Normalised: trimmed, single spaces, 2 to 120 characters. */
  readonly q: string;
  /** Bias point, rounded to about 1 km; Pasto when none is given. */
  readonly near: Point;
  /** Bounded search around a municipality (at most 5 candidates). */
  readonly within?: Within;
}

/** What the reverse geocoding proposes for a confirmed point (always approximate). */
export interface ReverseAddress {
  readonly street: string | null;
  readonly houseNumber: string | null;
  readonly neighbourhood: string | null;
  readonly city: string | null;
}

export const MAX_PLACES = 8;
/** Candidates of a bounded (municipality) search. */
export const MAX_CANDIDATES = 5;
const DEFAULT_RADIUS_KM = 15;
const MAX_RADIUS_KM = 30;
const KM_PER_DEGREE = 111.32;
export const PASTO: Point = { lat: 1.2136, lng: -77.2811 };
/** Colombia (with San Andrés), [minLng, minLat, maxLng, maxLat]. */
export const COLOMBIA_BBOX = [-81.8, -4.3, -66.8, 13.6] as const;
/** Nariño, used as the preferred view box. */
export const NARINO_BBOX = [-79.1, 0.3, -76.8, 2.7] as const;

function inColombia(point: Point): boolean {
  const [minLng, minLat, maxLng, maxLat] = COLOMBIA_BBOX;
  return point.lng >= minLng && point.lng <= maxLng && point.lat >= minLat && point.lat <= maxLat;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** A point inside Colombia from untrusted input, or null. */
function pointOf(value: unknown): Point | null {
  if (typeof value !== 'object' || value === null) return null;
  const { lat, lng } = value as Record<string, unknown>;
  return typeof lat === 'number' && typeof lng === 'number' && inColombia({ lat, lng }) ? { lat, lng } : null;
}

function withinOf(value: unknown): Within | undefined {
  const centre = pointOf(value);
  if (!centre) return undefined;
  const radius = (value as Record<string, unknown>)['radiusKm'];
  const radiusKm = typeof radius === 'number' && radius > 0 ? Math.min(radius, MAX_RADIUS_KM) : DEFAULT_RADIUS_KM;
  return { centre: { lat: round3(centre.lat), lng: round3(centre.lng) }, radiusKm };
}

/** [minLng, minLat, maxLng, maxLat] of a square of radiusKm around the centre. */
export function viewboxAround({ centre, radiusKm }: Within): readonly [number, number, number, number] {
  const dLat = radiusKm / KM_PER_DEGREE;
  const dLng = radiusKm / (KM_PER_DEGREE * Math.cos((centre.lat * Math.PI) / 180));
  return [centre.lng - dLng, centre.lat - dLat, centre.lng + dLng, centre.lat + dLat];
}

/** { reverse: { lat, lng } } → the point, rounded to about 10 m (enough for an address). */
export function parseReverse(body: unknown): Point | null {
  if (typeof body !== 'object' || body === null) return null;
  const point = pointOf((body as Record<string, unknown>)['reverse']);
  return point && { lat: Math.round(point.lat * 10_000) / 10_000, lng: Math.round(point.lng * 10_000) / 10_000 };
}

/** { q, near? }; null when q is too short or too long. */
export function parseInput(body: unknown): GeocodeInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const { q, near, within } = body as Record<string, unknown>;
  if (typeof q !== 'string') return null;
  const query = q.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (query.length < 2 || query.length > 120) return null;
  const point = pointOf(near);
  // Rounded: the provider never receives the exact position of the user.
  const bias = point ? { lat: round2(point.lat), lng: round2(point.lng) } : PASTO;
  const box = withinOf(within);
  return box ? { q: query, near: bias, within: box } : { q: query, near: bias };
}

/** Plain label, at most 120 characters. */
export function cleanLabel(parts: readonly unknown[]): string | null {
  const seen = new Set<string>();
  const words = parts
    .filter((part): part is string => typeof part === 'string')
    .map((part) => part.replace(/[\p{Cc}\p{Cf}<>]/gu, ' ').replace(/\s+/g, ' ').trim())
    .filter((part) => part.length > 0 && !seen.has(part.toLowerCase()) && seen.add(part.toLowerCase()));
  const label = words.join(', ').slice(0, 120).trim();
  return label.length > 0 ? label : null;
}

/** Keeps places with a label and coordinates inside Colombia, without repeats, at most 8. */
export function finalizePlaces(places: readonly (Place | null)[]): Place[] {
  const seen = new Set<string>();
  return places
    .filter((p): p is Place => p !== null && Number.isFinite(p.lat) && Number.isFinite(p.lng) && inColombia(p))
    .filter((p) => !seen.has(p.label.toLowerCase()) && seen.add(p.label.toLowerCase()))
    .slice(0, MAX_PLACES);
}
