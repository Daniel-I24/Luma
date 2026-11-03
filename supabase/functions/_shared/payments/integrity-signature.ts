import type { Money } from './money.ts';
import { sha256Hex } from '../secure-compare.ts';

/** What Wompi signs for a checkout (docs.wompi.co, Web Checkout, step 3). */
export interface SignedCheckout {
  readonly reference: string;
  readonly amount: Money;
  /** ISO 8601 UTC; when present it is part of the signature. */
  readonly expirationTime: string | null;
}

/**
 * IntegritySignature — SHA-256 of reference + amount in cents + currency
 * (+ expiration time) + integrity secret, in that order, lower-case hex.
 * Only Edge Functions hold the secret.
 */
export class IntegritySignature {
  public static async sign(checkout: SignedCheckout, integritySecret: string): Promise<string> {
    const { reference, amount, expirationTime } = checkout;
    return await sha256Hex(`${reference}${amount.cents}${amount.currency}${expirationTime ?? ''}${integritySecret}`);
  }
}
