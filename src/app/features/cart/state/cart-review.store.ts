import { Injectable, inject, signal } from '@angular/core';
import { MenuRepository } from '@shared/business/data/menu.repository';
import { CartStore } from '@shared/cart/cart.store';
import { type CartNotice, reviewCart } from '../utils/cart-review.util';

export type CartReviewState = 'idle' | 'checking' | 'checked' | 'failed';

/**
 * CartReviewStore — when /cart opens, re-reads the items from the server,
 * tells the user about price changes and items no longer sold, and brings
 * the cart up to date. Client prices stay informative only.
 */
@Injectable()
export class CartReviewStore {
  private readonly menu = inject(MenuRepository);
  private readonly cart = inject(CartStore);

  private readonly _state = signal<CartReviewState>('idle');
  private readonly _notices = signal<readonly CartNotice[]>([]);

  readonly state = this._state.asReadonly();
  readonly notices = this._notices.asReadonly();

  async check(): Promise<void> {
    const items = this.cart.items();
    if (items.length === 0) return;
    this._state.set('checking');
    const result = await this.menu.getItemsByIds(items.map((item) => item.menuItemId));
    if (!result.data) {
      this._state.set('failed');
      return;
    }
    const review = reviewCart(items, result.data);
    this._notices.set(review.notices);
    this.cart.reconcile(review.prices);
    this._state.set('checked');
  }
}
