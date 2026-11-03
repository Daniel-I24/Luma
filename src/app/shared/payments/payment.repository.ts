import { Injectable, inject } from '@angular/core';
import { FunctionsHttpError } from '@supabase/supabase-js';
import * as z from 'zod/mini';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '@shared/business/data/business.repository';
import type { PaymentStatus } from '@shared/orders/order.model';

/** payment_config(): whether online payment is offered, and in the sandbox. */
export interface PaymentConfig {
  readonly enabled: boolean;
  readonly sandbox: boolean;
}

/** my_order_payment(order). */
export interface OrderPayment {
  readonly status: PaymentStatus;
  readonly attemptsUsed: number;
  readonly attemptsMax: number;
  /** When the unpaid order is cancelled. */
  readonly expiresAt: string | null;
}

const checkoutSchema = z.object({ checkout_url: z.string(), expires_at: z.string(), sandbox: z.boolean() });
const CHECKOUT_ERRORS: Readonly<Record<string, string>> = {
  too_many_attempts: 'payments.errors.tooManyAttempts',
  payment_expired: 'payments.errors.expired',
  already_paid: 'payments.errors.alreadyPaid',
  order_not_payable: 'payments.errors.notPayable',
  rate_limited: 'payments.errors.rateLimited',
  email_not_confirmed: 'errors.emailNotConfirmed',
};
const OFF: PaymentConfig = { enabled: false, sandbox: false };

/**
 * PaymentRepository — the app's side of online payments: the public config,
 * the payment state of an order, the checkout link (create-payment, signed on
 * the server) and the transaction id of Wompi's redirect (untrusted; the
 * server confirms it with Wompi). Never an amount: the server sets it.
 */
@Injectable({ providedIn: 'root' })
export class PaymentRepository {
  private readonly db = inject(SupabaseService).client;

  /** Off when unknown: online payment is never offered on a guess. */
  public async config(): Promise<PaymentConfig> {
    const { data, error } = await this.db.rpc('payment_config');
    const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
    if (error || !row) return OFF;
    return { enabled: row['enabled'] === true, sandbox: row['sandbox'] === true };
  }

  public async orderPayment(orderId: string): Promise<RepoResult<OrderPayment>> {
    const { data, error } = await this.db.rpc('my_order_payment', { p_order_id: orderId });
    const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
    if (error || !row) return { data: null, errorKey: 'payments.errors.loadFailed' };
    return {
      data: {
        status: row['payment_status'] as PaymentStatus,
        attemptsUsed: Number(row['attempts_used']),
        attemptsMax: Number(row['attempts_max']),
        expiresAt: typeof row['expires_at'] === 'string' ? row['expires_at'] : null,
      },
      errorKey: null,
    };
  }

  /** The signed Wompi checkout URL for a new attempt. */
  public async checkoutUrl(orderId: string): Promise<RepoResult<string>> {
    try {
      const { data, error } = await this.db.functions.invoke('create-payment', { method: 'POST', body: { order_id: orderId } });
      if (error) return { data: null, errorKey: await this.errorKey(error) };
      const parsed = checkoutSchema.safeParse(data);
      return parsed.success ? { data: parsed.data.checkout_url, errorKey: null } : { data: null, errorKey: 'payments.errors.unavailable' };
    } catch {
      return { data: null, errorKey: 'payments.errors.unavailable' };
    }
  }

  /** Best effort: reconcile-payments uses it only after asking Wompi. */
  public async recordRedirect(orderId: string, transactionId: string): Promise<void> {
    await this.db.rpc('record_payment_redirect', { p_order_id: orderId, p_transaction_id: transactionId });
  }

  private async errorKey(error: unknown): Promise<string> {
    if (!(error instanceof FunctionsHttpError) || !(error.context instanceof Response)) return 'payments.errors.unavailable';
    const body: unknown = await error.context.json().catch(() => null);
    const code = typeof body === 'object' && body !== null ? (body as Record<string, unknown>)['error'] : null;
    return (typeof code === 'string' && CHECKOUT_ERRORS[code]) || 'payments.errors.unavailable';
  }
}
