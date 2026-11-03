/** What the map search shows for a neighbourhood, an address or a place. */
export const PLACE_KINDS = ['address', 'street', 'neighbourhood', 'city', 'poi'] as const;
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

export interface GeocodeInput {
  /** Normalised: trimmed, single spaces, 2 to 120 characters. */
  readonly q: string;
  /** Bias point, rounded to about 1 km; Pasto when none is given. */
  readonly near: Point;
}

export const MAX_PLACES = 8;
export const PASTO: Point = { lat: 1.2136, lng: -77.2811 };
/** Colombia (with San Andrés), [minLng, minLat, maxLng, maxLat]. */
export const COLOMBIA_BBOX = [-81.8, -4.3, -66.8, 13.6] as const;
/** Nariño, used as the preferred view box. */
export const NARINO_BBOX = [-79.1, 0.3, -76.8, 2.7] as const;

export function inColombia(point: Point): boolean {
  const [minLng, minLat, maxLng, maxLat] = COLOMBIA_BBOX;
  return point.lng >= minLng && point.lng <= maxLng && point.lat >= minLat && point.lat <= maxLat;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** { q, near? }; null when q is too short or too long. */
export function parseInput(body: unknown): GeocodeInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const { q, near } = body as Record<string, unknown>;
  if (typeof q !== 'string') return null;
  const query = q.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (query.length < 2 || query.length > 120) return null;
  let bias = PASTO;
  if (typeof near === 'object' && near !== null) {
    const { lat, lng } = near as Record<string, unknown>;
    if (typeof lat === 'number' && typeof lng === 'number' && inColombia({ lat, lng })) {
      // Rounded: the provider never receives the exact position of the user.
      bias = { lat: round2(lat), lng: round2(lng) };
    }
  }
  return { q: query, near: bias };
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
