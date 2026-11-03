import { Injectable, inject, signal } from '@angular/core';
import {
  type AuditEntry,
  type CustomerStrikes,
  AdminOperationsRepository,
  type PaymentIssue,
} from '../services/admin-operations.repository';

/**
 * AdminOperationsStore — /admin/operations: payments that need a person
 * (refunds, mismatches, errors), customers with no-show strikes, and the
 * latest entries of the audit log. Every action reloads the three lists.
 */
@Injectable()
export class AdminOperationsStore {
  private readonly repo = inject(AdminOperationsRepository);

  private readonly _issues = signal<readonly PaymentIssue[]>([]);
  private readonly _strikes = signal<readonly CustomerStrikes[]>([]);
  private readonly _audit = signal<readonly AuditEntry[]>([]);
  private readonly _state = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly _busy = signal(false);
  private readonly _notice = signal<string | null>(null);

  public readonly issues = this._issues.asReadonly();
  public readonly strikes = this._strikes.asReadonly();
  public readonly audit = this._audit.asReadonly();
  public readonly state = this._state.asReadonly();
  public readonly busy = this._busy.asReadonly();
  /** Translation key of the outcome of the last action. */
  public readonly notice = this._notice.asReadonly();

  /** Loads payment issues, strikes and the audit log. */
  public async load(): Promise<void> {
    const [issues, strikes, audit] = await Promise.all([
      this.repo.paymentIssues(), this.repo.strikes(), this.repo.recentAudit(),
    ]);
    if (!issues.data || !strikes.data || !audit.data) {
      this._state.set('error');
      return;
    }
    this._issues.set(issues.data);
    this._strikes.set(strikes.data);
    this._audit.set(audit.data);
    this._state.set('ready');
  }

  /** Voids a card payment in Wompi and reloads. */
  public voidPayment(issue: PaymentIssue): Promise<void> {
    return this.act(async () => {
      const result = await this.repo.voidPayment(issue.payment_id);
      return result.data ? `admin.operations.void.${result.data}` : result.errorKey;
    });
  }

  /** Marks a refund as done and reloads. */
  public markRefundDone(issue: PaymentIssue): Promise<void> {
    return this.act(async () => (await this.repo.markRefundDone(issue.payment_id)).errorKey ?? 'admin.operations.refundMarked');
  }

  /** Clears a customer's strikes and reloads. */
  public clearStrikes(customer: CustomerStrikes): Promise<void> {
    return this.act(async () => (await this.repo.clearStrikes(customer.user_id)).errorKey ?? 'admin.operations.strikesCleared');
  }

  /** Runs reconciliation and reloads. */
  public reconcile(): Promise<void> {
    return this.act(async () => {
      const result = await this.repo.reconcile();
      return result.errorKey ?? 'admin.operations.reconciled';
    });
  }

  private async act(action: () => Promise<string | null>): Promise<void> {
    if (this._busy()) return;
    this._busy.set(true);
    try {
      this._notice.set(await action());
      await this.load();
    } finally {
      this._busy.set(false);
    }
  }
}
