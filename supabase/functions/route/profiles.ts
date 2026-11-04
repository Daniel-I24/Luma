/** How the customer travels. Kept in sync with src/app/shared/route/travel-modes.ts. */
export type TravelMode = 'walk' | 'bike' | 'moto' | 'drive';

export const TRAVEL_MODES: readonly TravelMode[] = ['walk', 'bike', 'moto', 'drive'];

/** The OpenRouteService profile of a mode, the factor applied to its time and whether that time is approximate. */
export interface TravelProfile {
  readonly ors: 'foot-walking' | 'cycling-regular' | 'driving-car';
  /** The FOSSGIS OSRM server of the mode (routed-car, routed-bike, routed-foot). */
  readonly osrm: 'car' | 'bike' | 'foot';
  readonly timeFactor: number;
  readonly approximate: boolean;
  /** Average speed of the straight-line estimate, km/h (docs/route.md). */
  readonly straightKmh: number;
}

/**
 * OpenRouteService has no motorcycle profile: the moto uses driving-car with
 * 0.8 of its time (motorcycles move through city traffic faster) and the app
 * says "tiempo aproximado".
 */
const PROFILES: Readonly<Record<TravelMode, TravelProfile>> = {
  walk: { ors: 'foot-walking', osrm: 'foot', timeFactor: 1, approximate: false, straightKmh: 4.8 },
  bike: { ors: 'cycling-regular', osrm: 'bike', timeFactor: 1, approximate: false, straightKmh: 15 },
  moto: { ors: 'driving-car', osrm: 'car', timeFactor: 0.8, approximate: true, straightKmh: 30 },
  drive: { ors: 'driving-car', osrm: 'car', timeFactor: 1, approximate: false, straightKmh: 25 },
};

/** The profile of a mode. */
export function profileFor(mode: TravelMode): TravelProfile {
  return PROFILES[mode];
}

/** True for one of the four modes. */
export function isTravelMode(value: unknown): value is TravelMode {
  return typeof value === 'string' && (TRAVEL_MODES as readonly string[]).includes(value);
}
