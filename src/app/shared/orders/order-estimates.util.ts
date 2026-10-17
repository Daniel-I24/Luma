import type { Order } from './order.model';

/** Up to this distance the estimate assumes walking. */
export const WALK_MAX_KM = 1.5;
/** About 4.8 km/h. */
const WALK_KM_PER_MIN = 0.08;
/** City traffic in Pasto, about 20 km/h. */
const VEHICLE_KM_PER_MIN = 20 / 60;
/** Used when the business's preparation time is not available. */
export const DEFAULT_PREP_MINUTES = 20;

export interface TravelEstimate {
  readonly mode: 'walk' | 'vehicle';
  readonly minutes: number;
  /** Straight-line distance, not a route: always an approximation. */
  readonly approximate: true;
}

/** Rough travel time over a straight-line distance (at least 1 minute). */
export function estimateTravelMinutes(distanceKm: number): TravelEstimate {
  const walk = distanceKm <= WALK_MAX_KM;
  const speed = walk ? WALK_KM_PER_MIN : VEHICLE_KM_PER_MIN;
  return {
    mode: walk ? 'walk' : 'vehicle',
    minutes: Math.max(1, Math.ceil(distanceKm / speed)),
    approximate: true,
  };
}

export interface ReadyEstimate {
  /** 'pickup': the requested time; 'ready': creation + preparation time. */
  readonly kind: 'pickup' | 'ready';
  readonly at: string;
}

/**
 * When the order should be ready: the requested pick-up time ("Para recoger
 * a las HH:MM") or, as soon as possible, created_at + prep_minutes
 * ("Listo aprox. a las HH:MM").
 */
export function estimateReadyAt(
  order: Pick<Order, 'pickup_at' | 'created_at'>,
  prepMinutes: number | null | undefined,
): ReadyEstimate {
  if (order.pickup_at) return { kind: 'pickup', at: order.pickup_at };
  const minutes = prepMinutes ?? DEFAULT_PREP_MINUTES;
  return {
    kind: 'ready',
    at: new Date(Date.parse(order.created_at) + minutes * 60_000).toISOString(),
  };
}
