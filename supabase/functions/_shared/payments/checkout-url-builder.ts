import { WOMPI_CHECKOUT_URL } from '../config/provider-urls.ts';
import { IntegritySignature } from './integrity-signature.ts';
import type { MerchantCredentials } from './merchant-credentials.ts';
import type { Money } from './money.ts';

/**
 * CheckoutUrlBuilder — the Wompi Web Checkout link (GET form of
 * docs.wompi.co, "Widget & Checkout Web"): public key, COP, amount in cents,
 * reference, integrity signature, redirect URL and expiration time. Only
 * Edge Functions build it, because only they hold the integrity secret.
 */
export class CheckoutUrlBuilder {
  private reference: string | null = null;
  private amount: Money | null = null;
  private redirectUrl: string | null = null;
  private expiresAt: Date | null = null;

  public constructor(private readonly credentials: MerchantCredentials) {}

  public withReference(reference: string): this {
    this.reference = reference;
    return this;
  }

  public withAmount(amount: Money): this {
    this.amount = amount;
    return this;
  }

  public withRedirectUrl(url: string): this {
    this.redirectUrl = url;
    return this;
  }

  /** The link stops working at this time; Wompi signs it too. */
  public expiringAt(at: Date): this {
    this.expiresAt = at;
    return this;
  }

  public async build(): Promise<string> {
    if (!this.reference || !this.amount || !this.redirectUrl || !this.expiresAt) throw new Error('incomplete_checkout');
    // ISO 8601 UTC with milliseconds, as in the Wompi examples ("2023-06-09T20:28:50.000Z").
    const expirationTime = this.expiresAt.toISOString();
    const signature = await IntegritySignature.sign(
      { reference: this.reference, amount: this.amount, expirationTime }, this.credentials.integritySecret,
    );
    const query = new URLSearchParams({
      'public-key': this.credentials.publicKey,
      currency: this.amount.currency,
      'amount-in-cents': String(this.amount.cents),
      reference: this.reference,
      'signature:integrity': signature,
      'redirect-url': this.redirectUrl,
      'expiration-time': expirationTime,
    });
    return `${WOMPI_CHECKOUT_URL}?${query.toString()}`;
  }
}
