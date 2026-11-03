import { FieldRules } from './field-rule';
import { Nit } from './nit';
import { type Specification, Spec } from './specification';

export const PRICE_MIN_COP = 100;
export const PRICE_MAX_COP = 10_000_000;
export const DISCOUNT_MIN = 1;
export const DISCOUNT_MAX = 90;
/** A promotion lasts at most a year (and a day for leap years). */
export const PROMOTION_MAX_DAYS = 366;
const MS_PER_DAY = 86_400_000;

/** "$ 12.500" → "12500": only the digits count (the field filters the rest). */
const digits = (raw: string): string => raw.replace(/\D/g, '');
const wholeNumber = (min: number, max: number): Specification<string> => Spec.of((value: string) => /^\d{1,9}$/.test(value) && Spec.integer(min, max).isSatisfiedBy(Number(value)));

/** NumberRules — prices, discounts and the NIT. */
export const NumberRules = {
  /** A whole price in pesos, 100 to 10 000 000. */
  price: FieldRules.define({ messageKey: 'validation.price', maxLength: 12, normalize: digits, spec: wholeNumber(PRICE_MIN_COP, PRICE_MAX_COP) }),
  /** A whole percentage, 1 to 90. */
  discount: FieldRules.define({ messageKey: 'validation.discount', maxLength: 2, normalize: digits, spec: wholeNumber(DISCOUNT_MIN, DISCOUNT_MAX) }),
  /** NIT with its DIAN check digit, stored as "800197268-4". */
  nit: FieldRules.define({
    messageKey: 'validation.nit',
    maxLength: 20,
    normalize: (raw) => Nit.parse(raw)?.value ?? raw.trim(),
    spec: Spec.of((value) => Nit.parse(value)?.value === value),
  }),
} as const;

/** The same limits for values that already are numbers. */
export const NumberSpecs = {
  price: Spec.integer(PRICE_MIN_COP, PRICE_MAX_COP),
  discount: Spec.integer(DISCOUNT_MIN, DISCOUNT_MAX),
} as const;

/** DateRules — dates that make sense together. */
export class DateRules {
  /**
   * A period: valid dates, the end after the start, at most a year long and,
   * for a new one, not already over. Returns a message key or null.
   */
  public static period(startsAt: string, endsAt: string, now: number, isNew: boolean): string | null {
    const start = Date.parse(startsAt);
    const end = Date.parse(endsAt);
    if (Number.isNaN(start) || Number.isNaN(end)) return 'validation.date';
    if (end <= start) return 'validation.datesOrder';
    if (end - start > PROMOTION_MAX_DAYS * MS_PER_DAY) return 'validation.datesTooLong';
    return isNew && end <= now ? 'validation.datesPast' : null;
  }
}
