import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '@shared/business/data/business.repository';

/** business_review_flags(business): warning signs for the review. */
export interface ReviewFlags {
  readonly duplicate_tax_id: boolean;
  readonly duplicate_phone: boolean;
  readonly near_duplicate_location: boolean;
  readonly similar_name: boolean;
  readonly owner_account_age_days: number;
  readonly owner_business_count: number;
}

/** admin_payment_issues(): ids, amounts and statuses only. */
export interface PaymentIssue {
  readonly payment_id: string;
  readonly order_id: string;
  readonly amount_in_cents: number;
  readonly status: string;
  readonly payment_method_type: string | null;
  readonly issue: 'refund_required' | 'mismatch' | 'error' | 'stuck_pending';
  readonly created_at: string;
}

export interface CustomerStrikes {
  readonly user_id: string;
  readonly strikes: number;
  readonly last_strike_at: string | null;
  readonly tier: string;
}

export interface AuditEntry {
  readonly id: number;
  readonly action: string;
  readonly target_type: string;
  readonly detail: string | null;
  readonly created_at: string;
}

const FAILED = 'admin.operations.errors.failed';

/**
 * AdminOperationsRepository — the admin tools of round 2. Every call runs
 * as the admin (is_admin needs aal2) and every action is logged by the
 * database; voids and reconciliations go through their Edge Functions.
 */
@Injectable({ providedIn: 'root' })
export class AdminOperationsRepository {
  private readonly db = inject(SupabaseService).client;

  public async reviewFlags(businessId: string): Promise<RepoResult<ReviewFlags>> {
    const { data, error } = await this.db.rpc('business_review_flags', { p_business_id: businessId });
    const row = Array.isArray(data) ? (data[0] as ReviewFlags | undefined) : undefined;
    return error || !row ? { data: null, errorKey: FAILED } : { data: row, errorKey: null };
  }

  public paymentIssues(): Promise<RepoResult<PaymentIssue[]>> {
    return this.list<PaymentIssue>('admin_payment_issues', {});
  }

  public strikes(): Promise<RepoResult<CustomerStrikes[]>> {
    return this.list<CustomerStrikes>('admin_strikes', {});
  }

  public recentAudit(): Promise<RepoResult<AuditEntry[]>> {
    return this.list<AuditEntry>('admin_recent_audit', { p_limit: 30 });
  }

  public async clearStrikes(userId: string): Promise<RepoResult<true>> {
    return this.done(await this.db.rpc('admin_clear_strikes', { p_user_id: userId }));
  }

  public async markRefundDone(paymentId: string): Promise<RepoResult<true>> {
    return this.done(await this.db.rpc('admin_mark_refund_done', { p_payment_id: paymentId }));
  }

  /** 'voided' (card, by API), 'manual' (refund in the Wompi dashboard) or 'pending'. */
  public async voidPayment(paymentId: string): Promise<RepoResult<string>> {
    const { data, error } = await this.db.functions.invoke('void-payment', { method: 'POST', body: { payment_id: paymentId } });
    const result = (data as { result?: unknown } | null)?.result;
    return error || typeof result !== 'string' ? { data: null, errorKey: FAILED } : { data: result, errorKey: null };
  }

  public async reconcile(): Promise<RepoResult<number>> {
    const { data, error } = await this.db.functions.invoke('reconcile-payments', { method: 'POST' });
    const applied = (data as { applied?: unknown } | null)?.applied;
    return error || typeof applied !== 'number' ? { data: null, errorKey: FAILED } : { data: applied, errorKey: null };
  }

  private async list<T>(name: string, args: Record<string, unknown>): Promise<RepoResult<T[]>> {
    const { data, error } = await this.db.rpc(name, args);
    return error || !Array.isArray(data) ? { data: null, errorKey: FAILED } : { data: data as T[], errorKey: null };
  }

  private done({ error }: { error: unknown }): RepoResult<true> {
    return error ? { data: null, errorKey: FAILED } : { data: true, errorKey: null };
  }
}
