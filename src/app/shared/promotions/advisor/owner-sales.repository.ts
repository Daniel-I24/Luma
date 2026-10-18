import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '@shared/business/data/business.repository';
import { type SalesSummary, salesSummarySchema } from './promotion-idea';

const LOAD_FAILED = 'owner.ideas.loadFailed';

/** OwnerSalesRepository — what the promotion advisor reads for one owned business. */
@Injectable({ providedIn: 'root' })
export class OwnerSalesRepository {
  private readonly db = inject(SupabaseService).client;

  /** 60-day aggregates (owner_sales_summary checks the ownership). */
  async summary(businessId: string): Promise<RepoResult<SalesSummary>> {
    const { data, error } = await this.db.rpc('owner_sales_summary', { p_business_id: businessId });
    const parsed = salesSummarySchema.safeParse(data);
    return error || !parsed.success
      ? { data: null, errorKey: LOAD_FAILED }
      : { data: parsed.data, errorKey: null };
  }

  /** Items that already have a running promotion. */
  async promotedItems(businessId: string): Promise<RepoResult<Set<string>>> {
    const { data, error } = await this.db
      .from('promotions')
      .select('menu_item_id')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .gt('ends_at', new Date().toISOString());
    if (error || !data) return { data: null, errorKey: LOAD_FAILED };
    return {
      data: new Set(data.flatMap((row) => (row.menu_item_id ? [String(row.menu_item_id)] : []))),
      errorKey: null,
    };
  }
}
