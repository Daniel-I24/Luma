import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from './business.repository';

/**
 * FavoriteRepository — the signed-in user's favourite businesses. RLS scopes
 * every query to auth.uid(); user_id is filled in by the database.
 */
@Injectable({ providedIn: 'root' })
export class FavoriteRepository {
  private readonly db = inject(SupabaseService).client;

  /** Ids of the businesses the user saved, newest first. */
  async getFavoriteIds(): Promise<RepoResult<string[]>> {
    const { data, error } = await this.db
      .from('favorites')
      .select('business_id')
      .order('created_at', { ascending: false });

    if (error) return { data: null, errorKey: 'businesses.errors.favoritesFailed' };
    return {
      data: (data as { business_id: string }[]).map((row) => row.business_id),
      errorKey: null,
    };
  }

  async add(businessId: string): Promise<RepoResult<true>> {
    const { error } = await this.db.from('favorites').insert({ business_id: businessId });
    if (error) return { data: null, errorKey: 'businesses.errors.favoriteSaveFailed' };
    return { data: true, errorKey: null };
  }

  async remove(businessId: string): Promise<RepoResult<true>> {
    const { error } = await this.db.from('favorites').delete().eq('business_id', businessId);
    if (error) return { data: null, errorKey: 'businesses.errors.favoriteSaveFailed' };
    return { data: true, errorKey: null };
  }
}
