import type { MenuItem } from '@shared/business/models/menu.model';
import type { CartItem } from '@shared/cart/cart.model';

/** Something that changed since the item was added. */
export type CartNotice =
  | { kind: 'price'; name: string; before: number; after: number }
  | { kind: 'unavailable'; name: string };

export interface CartReview {
  notices: CartNotice[];
  /** Current price of every line still sold (input of CartStore.reconcile). */
  prices: Map<string, number>;
}

/**
 * Compares the cart with the current menu rows: a line is still sold when
 * its row came back available and from the same business.
 */
export function reviewCart(items: readonly CartItem[], current: readonly MenuItem[]): CartReview {
  const rows = new Map(current.map((row) => [row.id, row]));
  const notices: CartNotice[] = [];
  const prices = new Map<string, number>();

  for (const item of items) {
    const row = rows.get(item.menuItemId);
    if (!row || !row.is_available || row.business_id !== item.businessId) {
      notices.push({ kind: 'unavailable', name: item.name });
      continue;
    }
    prices.set(item.menuItemId, row.price_cop);
    if (row.price_cop !== item.priceCop) {
      notices.push({ kind: 'price', name: item.name, before: item.priceCop, after: row.price_cop });
    }
  }
  return { notices, prices };
}
