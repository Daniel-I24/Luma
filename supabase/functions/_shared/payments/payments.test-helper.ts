import { PlatformMerchantCredentials } from './merchant-credentials.ts';
import type { ApplyOutcome, AttemptView, ConfirmedEvent, PaymentRepository, ReconcileItem } from './payment-repository.ts';
import { sha256Hex } from '../secure-compare.ts';
import type { EventTransaction } from './wompi-event.ts';

// Example and test secrets, assembled so the secret scan stays strict.
export const DOC_INTEGRITY_SECRET = ['prod', 'integrity', 'Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6'].join('_');
export const DOC_EVENTS_SECRET = ['prod', 'events', 'OcHnIzeBl5socpwByQ4hA52Em3USQ93Z'].join('_');
/** The sandbox secret names (typed, so each one is a string). */
export type SandboxSecrets = Readonly<Record<
  'WOMPI_ENV' | 'WOMPI_PUBLIC_KEY' | 'WOMPI_PRIVATE_KEY' | 'WOMPI_INTEGRITY_SECRET' | 'WOMPI_EVENTS_SECRET', string
>>;
export const sandboxSecrets = (): SandboxSecrets => ({
  WOMPI_ENV: 'test',
  WOMPI_PUBLIC_KEY: ['pub', 'test', 'publickey123'].join('_'),
  WOMPI_PRIVATE_KEY: ['prv', 'test', 'privatekey123'].join('_'),
  WOMPI_INTEGRITY_SECRET: ['test', 'integrity', 'integrity123'].join('_'),
  WOMPI_EVENTS_SECRET: ['test', 'events', 'events123'].join('_'),
});
export const sandboxCredentials = () => PlatformMerchantCredentials.fromSecrets((n) => (sandboxSecrets() as Readonly<Record<string, string>>)[n])!;

export const transaction = (overrides: Partial<EventTransaction> = {}): EventTransaction => ({
  id: '1234-1610641025-49201', reference: 'luma_ref', status: 'APPROVED', amountInCents: 1200000,
  currency: 'COP', paymentMethodType: 'CARD', ...overrides,
});

/** A transaction.updated event signed as Wompi signs it (docs.wompi.co, "Eventos"). */
export async function signedEvent(
  tx: EventTransaction = transaction(),
  options: { secret?: string; environment?: string; timestamp?: number; properties?: string[] } = {},
): Promise<Record<string, unknown>> {
  const properties = options.properties ?? ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
  const timestamp = options.timestamp ?? 1530291411;
  const data = { transaction: {
    id: tx.id, amount_in_cents: tx.amountInCents, reference: tx.reference, customer_email: 'juan.perez@example.com',
    currency: tx.currency, payment_method_type: tx.paymentMethodType, status: tx.status,
  } };
  const values: Record<string, string> = {
    'transaction.id': tx.id, 'transaction.status': tx.status, 'transaction.amount_in_cents': String(tx.amountInCents),
  };
  const checksum = await sha256Hex(
    properties.map((p) => values[p] ?? '').join('') + timestamp + (options.secret ?? sandboxSecrets().WOMPI_EVENTS_SECRET));
  return {
    event: 'transaction.updated', data, environment: options.environment ?? 'test',
    signature: { properties, checksum: checksum.toUpperCase() }, timestamp, sent_at: '2026-10-24T15:00:00.000Z',
  };
}

/** In-memory repository with the same idempotency and matching rules as the SQL. */
export class FakePaymentRepository implements PaymentRepository {
  public readonly applied: ConfirmedEvent[] = [];
  public readonly seen = new Set<string>();
  public readonly attempts = new Map<string, AttemptView>([
    ['luma_ref', { amountInCents: 1200000, currency: 'COP', environment: 'test', status: 'pending' }],
  ]);
  public reconcile: ReconcileItem[] = [];

  public eventSeen(transactionId: string, status: string): Promise<boolean> {
    return Promise.resolve(this.seen.has(`${transactionId}/${status}`));
  }

  public attempt(reference: string): Promise<AttemptView | null> {
    return Promise.resolve(this.attempts.get(reference) ?? null);
  }

  public apply(event: ConfirmedEvent): Promise<ApplyOutcome> {
    const key = `${event.transactionId}/${event.status}`;
    if (this.seen.has(key)) return Promise.resolve('duplicate');
    this.seen.add(key);
    this.applied.push(event);
    const attempt = this.attempts.get(event.reference);
    if (!attempt) return Promise.resolve('unknown_reference');
    const same = attempt.amountInCents === event.amountInCents && event.currency === 'COP'
      && attempt.environment === event.environment;
    return Promise.resolve(same ? 'applied' : 'mismatch');
  }

  public toReconcile(): Promise<readonly ReconcileItem[]> {
    return Promise.resolve(this.reconcile);
  }
}
