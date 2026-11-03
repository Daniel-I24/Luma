/** DIAN weights, applied from the rightmost digit of the NIT body. */
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- data table: DIAN weights
const WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
const MODULUS = 11;
/** Rests 0 and 1 are the check digit themselves. */
const DIRECT_REST_LIMIT = 2;

/** NitDigits — the DIAN check digit of a NIT. */
export class NitDigits {
  /** DIAN check digit of a NIT body (digits only): sum mod 11, 0/1 or 11 - rest. */
  public static nitCheckDigit(body: string): number {
    const digits = [...body].reverse();
    const sum = digits.reduce((total, digit, i) => total + Number(digit) * WEIGHTS[i], 0);
    const rest = sum % MODULUS;
    return rest < DIRECT_REST_LIMIT ? rest : MODULUS - rest;
  }
}

/**
 * Nit — Colombian tax id with its check digit ("800197268-4"), the same rule
 * as public.is_valid_nit. A valid format does NOT prove that the NIT exists
 * or belongs to the business: admins check it in the RUES.
 */
export class Nit {
  private constructor(
    public readonly body: string,
    public readonly checkDigit: number,
  ) {}

  /** Accepts "800.197.268-4", "800197268-4" or "8001972684"; null when invalid. */
  public static parse(input: string | null | undefined): Nit | null {
    const cleaned = (input ?? '').replace(/[.\s]/g, '');
    const match = /^(\d{6,15})-?(\d)$/.exec(cleaned);
    if (!match) return null;
    const [, body, digit] = match;
    return NitDigits.nitCheckDigit(body) === Number(digit) ? new Nit(body, Number(digit)) : null;
  }

  /** Stored form: "800197268-4". */
  public get value(): string {
    return `${this.body}-${this.checkDigit}`;
  }

  /** Display form: "800.197.268-4". */
  public get display(): string {
    return `${this.body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${this.checkDigit}`;
  }
}
