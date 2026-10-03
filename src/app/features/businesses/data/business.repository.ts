import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { Business, BusinessHours, Promotion } from '../models/business.model';

/** Generic result wrapper — keeps Supabase errors out of the rest of the app. */
export interface RepoResult<T> {
  data: T | null;
  errorKey: string | null;
}

/**
 * BusinessRepository — data-access layer for businesses, hours and promotions.
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
  async getNearby(
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<RepoResult<Business[]>> {
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

  /** Returns all currently active and time-valid promotions for a business. */
  async getActivePromotions(businessId: string): Promise<RepoResult<Promotion[]>> {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from('promotions')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .lte('starts_at', now)
      .gte('ends_at', now);

    if (error) return { data: null, errorKey: 'businesses.errors.promotionsFailed' };
    return { data: data as Promotion[], errorKey: null };
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

// ── Private helpers ───────────────────────────────────────────────────────────

/** Haversine formula — returns distance in km between two WGS-84 points. */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
