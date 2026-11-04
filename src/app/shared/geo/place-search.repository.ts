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
const placeSchema = z.object({
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

const textOrNull = z.nullable(z.string().check(z.maxLength(MAX_PLACE_LABEL)));
const reverseSchema = z.object({
  address: z.nullable(z.object({ street: textOrNull, houseNumber: textOrNull, neighbourhood: textOrNull, city: textOrNull })),
  attribution: z.optional(z.nullable(z.enum(['locationiq']))),
});
/** What the reverse geocoding proposes for a point: always approximate, always editable. */
export type ApproximateAddress = NonNullable<z.infer<typeof reverseSchema>['address']>;

/** The municipality a bounded search stays in (its DANE centre). */
export interface SearchArea {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
}

export type PlaceSearchResult =
  | { readonly places: readonly Place[]; readonly attribution: PlaceAttribution; readonly errorKey: null }
  | { readonly places: null; readonly attribution?: undefined; readonly errorKey: string };

/** Credit the results must show (LocationIQ's free plan: "Search by LocationIQ.com"). */
export type PlaceAttribution = 'locationiq' | null;

/** PlaceSearchRepository — place search through the geocode Edge Function. */
@Injectable({ providedIn: 'root' })
export class PlaceSearchRepository {
  private readonly db = inject(SupabaseService).client;
  private readonly online = inject(ConnectivityService).online;

  /** Places matching `query` near a point (neighbourhoods, addresses, landmarks), or a translation key. */
  public async search(query: string, near: { lat: number; lng: number }, within?: SearchArea): Promise<PlaceSearchResult> {
    try {
      const { data, error } = await this.db.functions.invoke('geocode', {
        method: 'POST',
        body: within ? { q: query, near, within } : { q: query, near },
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

  /** One reverse geocoding call for a confirmed point; null address when the provider found none. */
  public async reverse(point: { lat: number; lng: number }): Promise<{ address: ApproximateAddress | null; errorKey: string | null }> {
    try {
      const { data, error } = await this.db.functions.invoke('geocode', { method: 'POST', body: { reverse: point } });
      if (error) return { address: null, errorKey: await this.errorKey(error) };
      const parsed = reverseSchema.safeParse(data);
      return parsed.success ? { address: parsed.data.address, errorKey: null } : { address: null, errorKey: 'map.places.unavailable' };
    } catch {
      return { address: null, errorKey: AuthErrors.networkErrorKey(this.online()) };
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
