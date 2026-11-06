import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '@shared/business/data/business.repository';
import { FunctionFailure } from './function-failure';

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

  /** Warning signs of a business under review. */
  public async reviewFlags(businessId: string): Promise<RepoResult<ReviewFlags>> {
    const { data, error } = await this.db.rpc('business_review_flags', { p_business_id: businessId });
    const row = Array.isArray(data) ? (data[0] as ReviewFlags | undefined) : undefined;
    return error || !row ? { data: null, errorKey: FAILED } : { data: row, errorKey: null };
  }

  /** Payments that need an admin (refunds, failures, pending too long). */
  public paymentIssues(): Promise<RepoResult<PaymentIssue[]>> {
    return this.list<PaymentIssue>('admin_payment_issues', {});
  }

  /** Customers with strikes. */
  public strikes(): Promise<RepoResult<CustomerStrikes[]>> {
    return this.list<CustomerStrikes>('admin_strikes', {});
  }

  /** Latest admin actions from the audit log. */
  public recentAudit(): Promise<RepoResult<AuditEntry[]>> {
    return this.list<AuditEntry>('admin_recent_audit', { p_limit: 30 });
  }

  /** Clears a customer's strikes (audited). */
  public async clearStrikes(userId: string): Promise<RepoResult<true>> {
    return this.done(await this.db.rpc('admin_clear_strikes', { p_user_id: userId }));
  }

  /** Marks a refund as done in Wompi's dashboard (audited). */
  public async markRefundDone(paymentId: string): Promise<RepoResult<true>> {
    return this.done(await this.db.rpc('admin_mark_refund_done', { p_payment_id: paymentId }));
  }

  /** 'voided' (card, by API), 'manual' (refund in the Wompi dashboard) or 'pending'. */
  public async voidPayment(paymentId: string): Promise<RepoResult<string>> {
    const { data, error } = await this.db.functions.invoke('void-payment', { method: 'POST', body: { payment_id: paymentId } });
    const result = (data as { result?: unknown } | null)?.result;
    if (error) return { data: null, errorKey: await this.failureKey(error) };
    return typeof result !== 'string' ? { data: null, errorKey: FAILED } : { data: result, errorKey: null };
  }

  /** Runs payment reconciliation now; returns how many payments changed. */
  public async reconcile(): Promise<RepoResult<number>> {
    const { data, error } = await this.db.functions.invoke('reconcile-payments', { method: 'POST' });
    const applied = (data as { applied?: unknown } | null)?.applied;
    if (error) return { data: null, errorKey: await this.failureKey(error) };
    return typeof applied !== 'number' ? { data: null, errorKey: FAILED } : { data: applied, errorKey: null };
  }

  /** Why a payment function failed; a 503 with payments switched off says so. */
  private async failureKey(error: unknown): Promise<string> {
    const { data } = await this.db.rpc('payment_config');
    const enabled = (data as { enabled?: unknown } | null)?.enabled;
    return FunctionFailure.withConfig(FunctionFailure.keyOf(error), typeof enabled === 'boolean' ? enabled : null);
  }

  private async list<T>(name: string, args: Record<string, unknown>): Promise<RepoResult<T[]>> {
    const { data, error } = await this.db.rpc(name, args);
    return error || !Array.isArray(data) ? { data: null, errorKey: FAILED } : { data: data as T[], errorKey: null };
  }

  private done({ error }: { error: unknown }): RepoResult<true> {
    return error ? { data: null, errorKey: FAILED } : { data: true, errorKey: null };
  }
}
