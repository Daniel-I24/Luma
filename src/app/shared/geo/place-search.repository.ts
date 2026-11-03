import { Injectable, inject } from '@angular/core';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
// zod/mini like the rest of the app: the classic build would land in the initial bundle.
import * as z from 'zod/mini';
import { networkErrorKey } from '@core/auth/auth-error';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';

/** A neighbourhood, address or place found by the geocode Edge Function. */
export const placeSchema = z.object({
  label: z.string().check(z.minLength(1), z.maxLength(120)),
  kind: z.enum(['address', 'street', 'neighbourhood', 'city', 'poi']),
  lat: z.number().check(z.gte(-4.3), z.lte(13.6)),
  lng: z.number().check(z.gte(-81.8), z.lte(-66.8)),
});
export type Place = z.infer<typeof placeSchema>;

const answerSchema = z.object({
  places: z.array(placeSchema).check(z.maxLength(8)),
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
  abstract search(query: string, near: { lat: number; lng: number }): Promise<PlaceSearchResult>;
}

export class GeocodePlaceSearchRepository extends PlaceSearchRepository {
  private readonly db = inject(SupabaseService).client;
  private readonly online = inject(ConnectivityService).online;

  async search(query: string, near: { lat: number; lng: number }): Promise<PlaceSearchResult> {
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
      return { places: null, errorKey: networkErrorKey(this.online()) };
    }
  }

  private async errorKey(error: unknown): Promise<string> {
    if (error instanceof FunctionsFetchError) return networkErrorKey(this.online());
    if (error instanceof FunctionsHttpError && error.context instanceof Response) {
      if (error.context.status === 429) return 'map.places.quota';
      if (error.context.status === 401) return 'auth.errors.sessionExpired';
    }
    // 503 geocode_unavailable (not configured or provider down) and the rest.
    return 'map.places.unavailable';
  }
}
