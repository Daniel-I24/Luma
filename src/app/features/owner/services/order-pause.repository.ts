import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '@shared/business/data/business.repository';

/** OrderPauseRepository — set_orders_paused(business, minutes): only the owner. */
@Injectable({ providedIn: 'root' })
export class OrderPauseRepository {
  private readonly db = inject(SupabaseService).client;

  /** 15, 30, 60 or 120 minutes, -1 until resumed, 0 resumes; resolves to the new end (or null). */
  public async set(businessId: string, minutes: number): Promise<RepoResult<string | null>> {
    const { data, error } = await this.db.rpc('set_orders_paused', { p_business_id: businessId, p_minutes: minutes });
    if (error) return { data: null, errorKey: 'owner.pause.errors.failed' };
    return { data: typeof data === 'string' ? data : null, errorKey: null };
  }
}
