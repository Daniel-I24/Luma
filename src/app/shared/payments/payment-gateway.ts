import { Injectable, inject } from '@angular/core';
import { ExternalUrls } from '@core/config/external-urls';
import { ExternalBrowser } from '@core/native/native-actions';
import { PaymentRepository } from './payment.repository';

export type PaymentMethod = 'pay_at_pickup' | 'online';

/** What happened after the order was created. */
type PaymentStart =
  | { readonly kind: 'pay_at_pickup' }
  | { readonly kind: 'redirected' }
  | { readonly kind: 'failed'; readonly errorKey: string; readonly retryAfterSeconds?: number };

/** How an order is paid (Strategy). The app never handles card data. */
export interface PaymentGateway {
  readonly method: PaymentMethod;
  /** Translation key of the method shown at checkout. */
  readonly labelKey: string;
  start(orderId: string): Promise<PaymentStart>;
}

/** The customer pays in the store when picking the order up. */
class PayAtPickupGateway implements PaymentGateway {
  public readonly method = 'pay_at_pickup';
  public readonly labelKey = 'checkout.payment.payAtPickup';

  /** Nothing to open: the customer pays at pick-up. */
  public start(): Promise<PaymentStart> {
    return Promise.resolve({ kind: 'pay_at_pickup' });
  }
}

/**
 * WompiGateway — asks create-payment for a signed checkout link and opens it
 * in the system browser. Only links to Wompi's checkout are opened.
 */
class WompiGateway implements PaymentGateway {
  public readonly method = 'online';
  public readonly labelKey = 'checkout.payment.online';

  constructor(
    private readonly payments: PaymentRepository,
    private readonly browser: ExternalBrowser,
  ) {}

  /** Prepares the attempt on the server and opens Wompi's checkout in the browser. */
  public async start(orderId: string): Promise<PaymentStart> {
    const link = await this.payments.checkoutUrl(orderId);
    if (!link.data) {
      const failed = { kind: 'failed', errorKey: link.errorKey ?? 'payments.errors.unavailable' } as const;
      return link.retryAfterSeconds ? { ...failed, retryAfterSeconds: link.retryAfterSeconds } : failed;
    }
    if (!link.data.startsWith(ExternalUrls.WOMPI_CHECKOUT)) return { kind: 'failed', errorKey: 'payments.errors.unavailable' };
    try {
      await this.browser.open(link.data);
      return { kind: 'redirected' };
    } catch {
      return { kind: 'failed', errorKey: 'payments.errors.browser' };
    }
  }
}

/** PaymentGatewayFactory — the gateway of a payment method. */
@Injectable({ providedIn: 'root' })
export class PaymentGatewayFactory {
  private readonly gateways: ReadonlyMap<PaymentMethod, PaymentGateway> = new Map<PaymentMethod, PaymentGateway>([
    ['pay_at_pickup', new PayAtPickupGateway()],
    ['online', new WompiGateway(inject(PaymentRepository), inject(ExternalBrowser))],
  ]);

  /** The gateway of a payment method. */
  public for(method: PaymentMethod): PaymentGateway {
    return this.gateways.get(method)!;
  }
}
