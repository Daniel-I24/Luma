import { Injectable, inject } from '@angular/core';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
// zod/mini like the rest of the app: the classic build would land in the initial bundle.
import * as z from 'zod/mini';
import { AuthErrors } from '@core/auth/auth-error';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { HTTP_STATUS } from '@core/config/http-status';

const MAX_PLACE_LABEL = 120;
const MAX_PLACES = 8;
/** Bounding box of Colombia: results outside it are dropped. */
const COLOMBIA = { south: -4.3, north: 13.6, west: -81.8, east: -66.8 } as const;

/** A neighbourhood, address or place found by the geocode Edge Function. */
export const placeSchema = z.object({
  label: z.string().check(z.minLength(1), z.maxLength(MAX_PLACE_LABEL)),
  kind: z.enum(['address', 'street', 'neighbourhood', 'city', 'poi']),
  lat: z.number().check(z.gte(COLOMBIA.south), z.lte(COLOMBIA.north)),
  lng: z.number().check(z.gte(COLOMBIA.west), z.lte(COLOMBIA.east)),
});
export type Place = z.infer<typeof placeSchema>;

const answerSchema = z.object({
  places: z.array(placeSchema).check(z.maxLength(MAX_PLACES)),
  /** Provider whose terms require a visible credit ('locationiq'), or null. */
  attribution: z.optional(z.nullable(z.enum(['locationiq']))),
});

export type PlaceSearchResult =
  | { readonly places: readonly Place[]; readonly attribution: PlaceAttribution; readonly errorKey: null }
  | { readonly places: null; readonly attribution?: undefined; readonly errorKey: string };

/** Credit the results must show (LocationIQ's free plan: "Search by LocationIQ.com"). */
export type PlaceAttribution = 'locationiq' | null;

/** Contract of the place search (the geocode function is one implementation). */
@Injectable({ providedIn: 'root', useFactory: () => new GeocodePlaceSearchRepository() })
export abstract class PlaceSearchRepository {
  /** `near` is rounded by the server before reaching any provider. */
  public abstract search(query: string, near: { lat: number; lng: number }): Promise<PlaceSearchResult>;
}

/** GeocodePlaceSearchRepository — place search through the geocode Edge Function. */
export class GeocodePlaceSearchRepository extends PlaceSearchRepository {
  private readonly db = inject(SupabaseService).client;
  private readonly online = inject(ConnectivityService).online;

  /** @inheritdoc */
  public async search(query: string, near: { lat: number; lng: number }): Promise<PlaceSearchResult> {
    try {
      const { data, error } = await this.db.functions.invoke('geocode', {
        method: 'POST',
        body: { q: query, near },
      });
      if (error) return { places: null, errorKey: await this.errorKey(error) };
      const parsed = answerSchema.safeParse(data);
      return parsed.success
        ? { places: parsed.data.places, attribution: parsed.data.attribution ?? null, errorKey: null }
        : { places: null, errorKey: 'map.places.unavailable' };
    } catch {
      return { places: null, errorKey: AuthErrors.networkErrorKey(this.online()) };
    }
  }

  private async errorKey(error: unknown): Promise<string> {
    if (error instanceof FunctionsFetchError) return AuthErrors.networkErrorKey(this.online());
    if (error instanceof FunctionsHttpError && error.context instanceof Response) {
      if (error.context.status === HTTP_STATUS.tooManyRequests) return 'map.places.quota';
      if (error.context.status === HTTP_STATUS.unauthorized) return 'auth.errors.sessionExpired';
    }
    // 503 geocode_unavailable (not configured or provider down) and the rest.
    return 'map.places.unavailable';
  }
}
