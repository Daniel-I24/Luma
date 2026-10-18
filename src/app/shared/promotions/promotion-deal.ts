import { bogotaDay } from '@shared/utils/business-day';

/**
 * Final price of a discounted item, exactly like public.promotion_price:
 * round(list * (100 - percent) / 100) to the nearest peso, halves up. The
 * app only shows it; create_order computes the price that is charged.
 */
export function promotionPrice(listCop: number, percent: number | null): number {
  if (percent === null) return listCop;
  return Math.round((listCop * (100 - percent)) / 100);
}

/** The discounted item of a deal. */
export interface DealItem {
  readonly id: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly listCop: number;
  readonly finalCop: number;
  readonly available: boolean;
}

/** A current promotion as customers see it, with its business and item. */
export interface PromotionDeal {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly imageUrl: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  /** null for promotions without a discount (text only). */
  readonly discountPercent: number | null;
  readonly item: DealItem | null;
  readonly business: {
    readonly id: string;
    readonly name: string;
    readonly category: string;
    readonly latitude: number;
    readonly longitude: number;
  };
}

/** How the end is said: "Termina hoy", "Termina mañana", "Termina en 3 días". */
export type EndsIn =
  | { readonly key: 'endsToday' }
  | { readonly key: 'endsTomorrow' }
  | { readonly key: 'endsInDays'; readonly days: number };

/** Days between today and the end date, both in Colombia. */
export function endsIn(endsAt: string, now: Date): EndsIn {
  const day = (instant: Date) => Date.parse(`${bogotaDay(instant)}T00:00:00Z`);
  const days = Math.round((day(new Date(endsAt)) - day(now)) / 86_400_000);
  if (days <= 0) return { key: 'endsToday' };
  if (days === 1) return { key: 'endsTomorrow' };
  return { key: 'endsInDays', days };
}
