import type { WompiEnvironment } from './merchant-credentials.ts';
import { Money } from './money.ts';
import type { ApplyOutcome, ConfirmedEvent, PaymentRepository } from './payment-repository.ts';
import type { EventTransaction } from './wompi-event.ts';

/**
 * PaymentApplier — last step for any transaction already confirmed with the
 * Wompi API (webhook, reconciliation, void): checks amount, COP and
 * environment against the attempt and hands it to apply_payment_event,
 * which checks them again and records a mismatch without approving.
 */
export class PaymentApplier {
  public constructor(
    private readonly repository: PaymentRepository,
    private readonly environment: WompiEnvironment,
  ) {}

  public async apply(tx: EventTransaction, source: ConfirmedEvent['source']): Promise<ApplyOutcome> {
    const attempt = await this.repository.attempt(tx.reference);
    const matches = attempt !== null && attempt.environment === this.environment
      && Money.fromCents(attempt.amountInCents).equals({ cents: tx.amountInCents, currency: tx.currency });
    const outcome = await this.repository.apply({
      reference: tx.reference, transactionId: tx.id, status: tx.status, amountInCents: tx.amountInCents,
      currency: tx.currency, environment: this.environment, paymentMethodType: tx.paymentMethodType, source,
    });
    return matches || outcome === 'unknown_reference' ? outcome : 'mismatch';
  }
}
