import * as z from 'zod/mini';
import type { MenuItem } from '@shared/business/models/menu.model';

/** Most units of one product in the cart. */
export const MAX_PER_ITEM = 20;
/** Most units in the whole cart. */
export const MAX_CART_UNITS = 50;

/** A product as it is offered (menu or feed), before choosing a quantity. */
export interface CartProduct {
  menuItemId: string;
  businessId: string;
  businessName: string;
  name: string;
  /** Whole COP, informative only: the server recalculates every price. */
  priceCop: number;
}

/** One line of the cart. */
export interface CartItem {
  menuItemId: string;
  businessId: string;
  name: string;
  priceCop: number;
  quantity: number;
}

/** A cart belongs to a single business. */
export interface CartSnapshot {
  businessName: string | null;
  items: CartItem[];
}

export const EMPTY_CART: CartSnapshot = { businessName: null, items: [] };

/** What is read back from localStorage is untrusted: validate it. */
export const cartSnapshotSchema = z.object({
  businessName: z.nullable(z.string().check(z.maxLength(120))),
  items: z
    .array(
      z.object({
        menuItemId: z.string().check(z.minLength(1)),
        businessId: z.string().check(z.minLength(1)),
        name: z.string().check(z.maxLength(80)),
        priceCop: z.int().check(z.nonnegative()),
        quantity: z.int().check(z.minimum(1), z.maximum(MAX_PER_ITEM)),
      }),
    )
    .check(z.maxLength(MAX_CART_UNITS)),
});

/** The cart product for a menu item of a business. */
export function toCartProduct(item: MenuItem, businessName: string): CartProduct {
  return {
    menuItemId: item.id,
    businessId: item.business_id,
    businessName,
    name: item.name,
    priceCop: item.price_cop,
  };
}

/** Total in whole pesos. */
export function cartTotal(items: readonly CartItem[]): number {
  return items.reduce((sum, item) => sum + item.priceCop * item.quantity, 0);
}

/** Units in the cart. */
export function cartUnits(items: readonly CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
