import { Injectable, inject } from '@angular/core';
import { ErrorLog } from '@core/errors/error-log';
import { Router } from '@angular/router';
import { AppEvents } from '@core/native/app-events';
import { PaymentRepository } from './payment.repository';

/** The parts of luma://payments/return?order=<uuid>&id=<transaction> the app trusts to route. */
export interface PaymentReturnLink {
  readonly orderId: string;
  readonly transactionId: string | null;
}

/**
 * PaymentReturn — Wompi sends the customer back to the app with
 * luma://payments/return. The link is informative only: the app stores the
 * transaction id for reconciliation and opens the order, whose status comes
 * from the server.
 */
@Injectable({ providedIn: 'root' })
export class PaymentReturn {
  public static readonly PREFIX = 'luma://payments/return';
  private static readonly UUID = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  private static readonly TRANSACTION = /^[0-9A-Za-z_-]{1,64}$/;

  private readonly events = inject(AppEvents);
  private readonly payments = inject(PaymentRepository);
  private readonly log = inject(ErrorLog);
  private readonly router = inject(Router);

  /** Null for any other link or a malformed one. */
  public static parse(url: string): PaymentReturnLink | null {
    const rest = url.startsWith(PaymentReturn.PREFIX) ? url.slice(PaymentReturn.PREFIX.length) : null;
    // Exactly the return path: "luma://payments/returned?…" is another link.
    if (rest === null || (rest !== '' && !rest.startsWith('?'))) return null;
    const query = new URLSearchParams(rest.slice(1));
    const orderId = query.get('order');
    if (!orderId || !PaymentReturn.UUID.test(orderId)) return null;
    const transactionId = query.get('id');
    return { orderId, transactionId: transactionId && PaymentReturn.TRANSACTION.test(transactionId) ? transactionId : null };
  }

  /** Called once at start-up. */
  public init(): void {
    this.events.onUrl((url) => void this.handle(url));
  }

  private async handle(url: string): Promise<void> {
    const link = PaymentReturn.parse(url);
    if (!link) return;
    await this.record(link);
    await this.router.navigate(['/orders', link.orderId], { state: { arrival: 'paid' } });
  }

  /** Best effort: the transaction id helps reconcile-payments; the status comes from the server. */
  public async record(link: PaymentReturnLink): Promise<void> {
    if (link.transactionId) await this.payments.recordRedirect(link.orderId, link.transactionId).catch((error: unknown) => this.log.record(error, 'payments'));
  }
}
