import { Injectable, inject } from '@angular/core';
import * as z from 'zod/mini';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '@shared/business/data/business.repository';

/** One day of owner_sales_daily (America/Bogota). */
export interface SalesDay {
  readonly day: string;
  readonly orders: number;
  readonly revenueCop: number;
}

export interface SalesSummary {
  readonly days: readonly SalesDay[];
  readonly topItems: readonly { readonly name: string; readonly quantity: number }[];
}

export type SalesRange = 7 | 30;

const schema = z.object({
  days: z.array(z.object({ day: z.string(), orders: z.number(), revenue_cop: z.number() })),
  top_items: z.array(z.object({ name: z.string(), quantity: z.number() })),
});

/** SalesSummaryRepository — owner_sales_daily(business, 7 or 30): aggregates only, no customer data. */
@Injectable({ providedIn: 'root' })
export class SalesSummaryRepository {
  private readonly db = inject(SupabaseService).client;

  /** Daily sales of a business over the range. */
  public async daily(businessId: string, range: SalesRange): Promise<RepoResult<SalesSummary>> {
    const { data, error } = await this.db.rpc('owner_sales_daily', { p_business_id: businessId, p_days: range });
    const parsed = schema.safeParse(data);
    if (error || !parsed.success) return { data: null, errorKey: 'owner.sales.errors.loadFailed' };
    return {
      data: {
        days: parsed.data.days.map((d) => ({ day: d.day, orders: d.orders, revenueCop: d.revenue_cop })),
        topItems: parsed.data.top_items,
      },
      errorKey: null,
    };
  }
}
