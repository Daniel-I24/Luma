/**
 * Money — an amount in COP cents, always a non-negative safe integer, built
 * from integer cents (prepare_payment and Wompi both give cents); never from floats.
 */
export class Money {
  private constructor(public readonly cents: number, public readonly currency: 'COP') {}

  /** Integer cents, as Wompi sends amount_in_cents. */
  public static fromCents(cents: number): Money {
    if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError('invalid_amount');
    return new Money(cents, 'COP');
  }

  /** Same amount and currency. */
  public equals(other: { readonly cents: number; readonly currency: string }): boolean {
    return this.cents === other.cents && this.currency === other.currency;
  }
}
