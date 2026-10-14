import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { haversineKm } from '@shared/geo/haversine.util';
import type { Business, BusinessHours } from '../models/business.model';

/** Generic result wrapper — keeps Supabase errors out of the rest of the app. */
export interface RepoResult<T> {
  data: T | null;
  errorKey: string | null;
}

/**
 * BusinessRepository — data-access layer for businesses and their hours
 * (promotions and ratings for many businesses: BusinessHighlightsRepository).
 *
 * - All methods return RepoResult; never throw.
 * - Raw Supabase errors are mapped to generic i18n keys.
 * - Proximity search uses a bounding-box pre-filter (no PostGIS required)
 *   followed by a Haversine distance filter on the client.
 */
@Injectable({ providedIn: 'root' })
export class BusinessRepository {
  private readonly db = inject(SupabaseService).client;

  /**
   * Returns active businesses within radiusKm of the given coordinates.
   * Uses a lat/lng bounding box in SQL, then filters by true distance.
   */
  async getNearby(lat: number, lng: number, radiusKm: number): Promise<RepoResult<Business[]>> {
    const delta = radiusKm / 111; // ~1° ≈ 111 km
    const { data, error } = await this.db
      .from('businesses')
      .select('*')
      .eq('is_active', true)
      .gte('latitude', lat - delta)
      .lte('latitude', lat + delta)
      .gte('longitude', lng - delta)
      .lte('longitude', lng + delta);

    if (error) return { data: null, errorKey: 'businesses.errors.loadFailed' };

    const nearby = (data as Business[]).filter(
      (b) => haversineKm(lat, lng, b.latitude, b.longitude) <= radiusKm,
    );

    return { data: nearby, errorKey: null };
  }

  /** Returns a single active business by id, or null if not found. */
  async getById(id: string): Promise<RepoResult<Business | null>> {
    const { data, error } = await this.db
      .from('businesses')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) return { data: null, errorKey: 'businesses.errors.loadFailed' };
    return { data: data as Business | null, errorKey: null };
  }

  /** Returns the full weekly schedule for a business. */
  async getHours(businessId: string): Promise<RepoResult<BusinessHours[]>> {
    const { data, error } = await this.db
      .from('business_hours')
      .select('*')
      .eq('business_id', businessId)
      .order('day_of_week');

    if (error) return { data: null, errorKey: 'businesses.errors.hoursFailed' };
    return { data: data as BusinessHours[], errorKey: null };
  }
}
