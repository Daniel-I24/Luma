import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { ContactKind } from '../verification/contact-verification';
import type { RepoResult } from './business.repository';

/** Completed orders, always as a range (never the exact count). */
type CompletedOrdersRange = '0' | '1_10' | '11_50' | '51_200' | '200_plus';

/** What a customer may know about a public business (business_trust_summary). */
export interface TrustSummary {
  readonly verified_since: string | null;
  readonly verified_contacts: readonly ContactKind[];
  readonly completed_orders: CompletedOrdersRange;
  readonly months_on_luma: number;
}

/**
 * TrustSummaryRepository — the public trust card of a business. The
 * function returns no NIT, legal name, documents or personal data
 * (docs/security.md, "Trust summary").
 */
@Injectable({ providedIn: 'root' })
export class TrustSummaryRepository {
  private readonly db = inject(SupabaseService).client;

  /** The summary of a public business; null when it is not public. */
  public async get(businessId: string): Promise<RepoResult<TrustSummary | null>> {
    const { data, error } = await this.db.rpc('business_trust_summary', { p_business_id: businessId });
    if (error) return { data: null, errorKey: 'businessProfile.trust.loadFailed' };
    const row = (Array.isArray(data) ? data[0] : data) as TrustSummary | undefined;
    return { data: row ?? null, errorKey: null };
  }
}
