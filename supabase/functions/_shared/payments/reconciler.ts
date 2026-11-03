import type { WompiEnvironment } from './merchant-credentials.ts';
import type { PaymentApplier } from './payment-applier.ts';
import type { PaymentRepository } from './payment-repository.ts';
import type { TransactionSource } from './payment-event-verifier.ts';

/** What one reconciliation run did. */
export interface ReconcileReport {
  readonly checked: number;
  readonly applied: number;
  readonly skipped: number;
}

/**
 * Reconciler — asks the Wompi API about open attempts that have a
 * transaction id (payments_to_reconcile) and applies what it confirms. The
 * redirect id is untrusted, so a transaction with another reference is
 * skipped. One failing attempt never stops the rest.
 */
export class Reconciler {
  public constructor(
    private readonly repository: PaymentRepository,
    private readonly api: TransactionSource,
    private readonly applier: PaymentApplier,
    private readonly environment: WompiEnvironment,
  ) {}

  public async run(): Promise<ReconcileReport> {
    let applied = 0;
    let skipped = 0;
    const items = await this.repository.toReconcile();
    for (const item of items) {
      try {
        const tx = item.environment === this.environment ? await this.api.transaction(item.transactionId) : null;
        if (!tx || tx.reference !== item.reference) {
          skipped++;
          continue;
        }
        if ((await this.applier.apply(tx, 'reconcile')) === 'applied') applied++;
      } catch {
        skipped++;
      }
    }
    return { checked: items.length, applied, skipped };
  }
}
