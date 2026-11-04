import { Injectable, inject } from '@angular/core';
import * as z from 'zod/mini';
import { SupabaseService } from '@core/supabase/supabase.service';
import { METERS_PER_KM } from '@core/config/units';
import { Haversine } from '@shared/geo/distance';
import { type TravelMode, TravelModePreference } from './travel-modes';

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

/** The way to draw: [lng, lat] pairs, meters, seconds and where it came from. */
export interface TravelRoute {
  readonly line: readonly (readonly [number, number])[];
  readonly distanceM: number;
  readonly durationS: number;
  /** 'straight': a line between both points with an estimated time (no routing provider). */
  readonly source: string;
  /** The time adjusts another profile (the moto uses the car's): "tiempo aproximado". */
  readonly approximate?: boolean;
  /** 'osm': drawn by the public OpenStreetMap servers; the map credits them. */
  readonly attribution?: 'osm';
}

// Same estimate as the route function (supabase/functions/route/model.ts).
const SECONDS_PER_HOUR = 3600;
const KMH_TO_MS = METERS_PER_KM / SECONDS_PER_HOUR;
const DETOUR_FACTOR = 1.3;
/** A line needs both ends. */
const MIN_POINTS = 2;

const routeSchema = z.object({
  line: z.array(z.tuple([z.number(), z.number()])).check(z.minLength(MIN_POINTS)),
  distanceM: z.number().check(z.minimum(0)),
  durationS: z.number().check(z.minimum(0)),
  source: z.string(),
  approximate: z.optional(z.boolean()),
  attribution: z.optional(z.literal('osm')),
});

/**
 * RouteRepository — the way from the customer to a business through the
 * route Edge Function (JWT, quota per user, cache; the routing key stays on
 * the server). It never fails the screen: without an answer it estimates a
 * straight line with distance and time, like the function does without a key.
 */
@Injectable({ providedIn: 'root' })
export class RouteRepository {
  private readonly db = inject(SupabaseService).client;

  /** The route from the function, or the straight-line estimate. */
  public async route(from: LatLng, to: LatLng, mode: TravelMode): Promise<TravelRoute> {
    try {
      const { data, error } = await this.db.functions.invoke('route', { method: 'POST', body: { from, to, mode } });
      const parsed = routeSchema.safeParse(data);
      if (!error && parsed.success) return parsed.data;
    } catch {
      // Offline or not deployed yet: the estimate below.
    }
    return RouteRepository.straight(from, to, mode);
  }

  /** A straight line, its distance times a detour factor and the time at the average speed of the mode. */
  public static straight(from: LatLng, to: LatLng, mode: TravelMode): TravelRoute {
    const distanceM = Math.round(Haversine.haversineKm(from.lat, from.lng, to.lat, to.lng) * METERS_PER_KM * DETOUR_FACTOR);
    const info = TravelModePreference.info(mode);
    return {
      line: [[from.lng, from.lat], [to.lng, to.lat]],
      distanceM,
      durationS: Math.round(distanceM / (info.straightKmh * KMH_TO_MS)),
      source: 'straight',
      ...(info.approximate ? { approximate: true } : {}),
    };
  }
}
