import { Injectable, inject } from '@angular/core';
import { ErrorCode } from '@core/errors/error-code';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { Haversine } from '@shared/geo/distance';
import type { Business, BusinessHours } from '../models/business.model';

/** One degree of latitude is about 111 km. */
const KM_PER_DEGREE = 111;

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
  private readonly online = inject(ConnectivityService).online;

  /**
   * Returns active businesses within radiusKm of the given coordinates.
   * Uses a lat/lng bounding box in SQL, then filters by true distance.
   */
  public async getNearby(lat: number, lng: number, radiusKm: number): Promise<RepoResult<Business[]>> {
    const delta = radiusKm / KM_PER_DEGREE;
    const { data, error } = await this.db
      .from('businesses')
      .select('*')
      .eq('is_active', true)
      .gte('latitude', lat - delta)
      .lte('latitude', lat + delta)
      .gte('longitude', lng - delta)
      .lte('longitude', lng + delta);

    if (error) return { data: null, errorKey: this.loadErrorKey(error) };
    if (!Array.isArray(data)) return { data: null, errorKey: 'businesses.errors.badData' };

    const nearby = (data as Business[]).filter(
      (b) => Haversine.haversineKm(lat, lng, b.latitude, b.longitude) <= radiusKm,
    );

    return { data: nearby, errorKey: null };
  }

  /** Why a read failed: no connection, or the service answered with an error. */
  private loadErrorKey(error: unknown): string {
    return !this.online() || ErrorCode.of(error) === 'network' ? 'businesses.errors.network' : 'businesses.errors.service';
  }

  /** Returns a single active business by id, or null if not found. */
  public async getById(id: string): Promise<RepoResult<Business | null>> {
    const { data, error } = await this.db
      .from('businesses')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) return { data: null, errorKey: 'businesses.errors.loadFailed' };
    return { data: data as Business | null, errorKey: null };
  }

  /** Active businesses with the given ids, in one query (order not guaranteed). */
  public async getByIds(ids: readonly string[]): Promise<RepoResult<Business[]>> {
    if (ids.length === 0) return { data: [], errorKey: null };
    const { data, error } = await this.db
      .from('businesses')
      .select('*')
      .in('id', [...ids])
      .eq('is_active', true);

    if (error) return { data: null, errorKey: 'businesses.errors.loadFailed' };
    return { data: data as Business[], errorKey: null };
  }

  /** Returns the full weekly schedule for a business. */
  public async getHours(businessId: string): Promise<RepoResult<BusinessHours[]>> {
    const { data, error } = await this.db
      .from('business_hours')
      .select('*')
      .eq('business_id', businessId)
      .order('day_of_week');

    if (error) return { data: null, errorKey: 'businesses.errors.hoursFailed' };
    return { data: data as BusinessHours[], errorKey: null };
  }

  /** Weekly schedules of many businesses in one query. */
  public async getHoursFor(businessIds: readonly string[]): Promise<RepoResult<BusinessHours[]>> {
    if (businessIds.length === 0) return { data: [], errorKey: null };
    const { data, error } = await this.db
      .from('business_hours')
      .select('*')
      .in('business_id', [...businessIds]);

    if (error) return { data: null, errorKey: 'businesses.errors.hoursFailed' };
    return { data: data as BusinessHours[], errorKey: null };
  }
}
