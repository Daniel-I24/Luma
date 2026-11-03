import type { WompiEnvironment } from './merchant-credentials.ts';

/** An attempt as the database has it (payment_attempt). */
export interface AttemptView {
  readonly amountInCents: number;
  readonly currency: string;
  readonly environment: WompiEnvironment;
  readonly status: string;
}

/** A transaction confirmed with the Wompi API, ready for apply_payment_event. */
export interface ConfirmedEvent {
  readonly reference: string;
  readonly transactionId: string;
  readonly status: string;
  readonly amountInCents: number;
  readonly currency: string;
  readonly environment: WompiEnvironment;
  readonly paymentMethodType: string | null;
  readonly source: 'webhook' | 'reconcile' | 'void';
}

export type ApplyOutcome = 'applied' | 'ignored' | 'mismatch' | 'unknown_reference' | 'duplicate';

/**
 * An open attempt to ask Wompi about (payments_to_reconcile). transactionId
 * is null for a pending attempt without a redirect id.
 */
export interface ReconcileItem {
  readonly reference: string;
  readonly transactionId: string | null;
  readonly environment: WompiEnvironment;
}

/** Server-only data access of the payment functions (service role, RPCs only). */
export interface PaymentRepository {
  eventSeen(transactionId: string, status: string): Promise<boolean>;
  attempt(reference: string): Promise<AttemptView | null>;
  apply(event: ConfirmedEvent): Promise<ApplyOutcome>;
  toReconcile(): Promise<readonly ReconcileItem[]>;
}

/** The part of a Supabase client the repository uses. */
export interface RpcClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}

const OUTCOMES = new Set<ApplyOutcome>(['applied', 'ignored', 'mismatch', 'unknown_reference', 'duplicate']);

/** PaymentRepository over the service-role client; every failure throws (the caller answers "retry"). */
export class SupabasePaymentRepository implements PaymentRepository {
  public constructor(private readonly service: RpcClient) {}

  public async eventSeen(transactionId: string, status: string): Promise<boolean> {
    return (await this.call('payment_event_seen', { p_transaction_id: transactionId, p_status: status })) === true;
  }

  public async attempt(reference: string): Promise<AttemptView | null> {
    const rows = await this.call('payment_attempt', { p_reference: reference });
    const row = Array.isArray(rows) ? rows[0] as Record<string, unknown> | undefined : undefined;
    if (!row) return null;
    return {
      amountInCents: Number(row['amount_in_cents']), currency: String(row['currency']),
      environment: row['environment'] === 'prod' ? 'prod' : 'test', status: String(row['status']),
    };
  }

  public async apply(event: ConfirmedEvent): Promise<ApplyOutcome> {
    const outcome = await this.call('apply_payment_event', {
      p_reference: event.reference, p_transaction_id: event.transactionId, p_status: event.status,
      p_amount_in_cents: event.amountInCents, p_currency: event.currency, p_environment: event.environment,
      p_payment_method_type: event.paymentMethodType, p_source: event.source,
    });
    if (typeof outcome !== 'string' || !OUTCOMES.has(outcome as ApplyOutcome)) throw new Error('apply_failed');
    return outcome as ApplyOutcome;
  }

  public async toReconcile(): Promise<readonly ReconcileItem[]> {
    const rows = await this.call('payments_to_reconcile', {});
    return (Array.isArray(rows) ? rows : []).map((row: Record<string, string | null>) => ({
      reference: String(row['reference']), transactionId: row['transaction_id'] ?? null,
      environment: row['environment'] === 'prod' ? 'prod' : 'test',
    }));
  }

  private async call(name: string, args: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await this.service.rpc(name, args);
    if (error) throw new Error(`${name}_failed`);
    return data;
  }
}
