import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { MenuItem } from '../models/menu.model';
import type { RepoResult } from './business.repository';

/**
 * MenuRepository — reads a business menu. RLS returns only available items
 * of active businesses (owners also see their unavailable ones).
 */
@Injectable({ providedIn: 'root' })
export class MenuRepository {
  private readonly db = inject(SupabaseService).client;

  /** Menu of a business, grouped by section then in the owner's order. */
  async getMenu(businessId: string): Promise<RepoResult<MenuItem[]>> {
    const { data, error } = await this.db
      .from('menu_items')
      .select('*')
      .eq('business_id', businessId)
      .order('section', { nullsFirst: false })
      .order('sort_order');

    if (error) return { data: null, errorKey: 'businesses.errors.menuFailed' };
    return { data: data as MenuItem[], errorKey: null };
  }

  /** Available items of many businesses in one query, in each owner's order. */
  async getAvailableFor(businessIds: readonly string[]): Promise<RepoResult<MenuItem[]>> {
    if (businessIds.length === 0) return { data: [], errorKey: null };
    const { data, error } = await this.db
      .from('menu_items')
      .select('*')
      .in('business_id', [...businessIds])
      .eq('is_available', true)
      .order('sort_order');

    if (error) return { data: null, errorKey: 'businesses.errors.menuFailed' };
    return { data: data as MenuItem[], errorKey: null };
  }
}
