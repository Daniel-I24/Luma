/**
 * Money — an amount in COP cents, always a non-negative safe integer. Built
 * only from the server's orders.total_cop (whole pesos) or from integer
 * cents; never from floats.
 */
export class Money {
  private static readonly CENTS_PER_PESO = 100;

  private constructor(public readonly cents: number, public readonly currency: 'COP') {}

  /** Whole pesos as stored in orders.total_cop. */
  public static fromPesos(pesos: number): Money {
    if (!Number.isSafeInteger(pesos) || pesos < 0) throw new RangeError('invalid_amount');
    return Money.fromCents(pesos * Money.CENTS_PER_PESO);
  }

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
