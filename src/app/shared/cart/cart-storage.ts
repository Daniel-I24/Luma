import { Injectable } from '@angular/core';
import { type CartSnapshot, EMPTY_CART, cartSnapshotSchema } from './cart.model';

const KEY_PREFIX = 'luma-cart:';

/**
 * CartStorage — one cart per user in localStorage. Reads are validated (the
 * stored value is untrusted); storage errors (private mode, quota) never
 * break the cart, which then simply lives in memory.
 */
@Injectable({ providedIn: 'root' })
export class CartStorage {
  load(userId: string): CartSnapshot {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + userId);
      if (!raw) return EMPTY_CART;
      const parsed = cartSnapshotSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : EMPTY_CART;
    } catch {
      return EMPTY_CART;
    }
  }

  save(userId: string, cart: CartSnapshot): void {
    try {
      if (cart.items.length === 0) localStorage.removeItem(KEY_PREFIX + userId);
      else localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(cart));
    } catch {
      // Storage unavailable: the cart keeps working in memory.
    }
  }

  remove(userId: string): void {
    this.save(userId, EMPTY_CART);
  }
}
