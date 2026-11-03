import { Injectable, inject, signal } from '@angular/core';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { MenuRepository } from '@shared/business/data/menu.repository';
import { BusinessPause } from '@shared/business/models/business-pause';
import { CartStore } from '@shared/cart/cart.store';
import { type CartNotice, CartReviewer } from '../utils/cart-reviewer';

export type CartReviewState = 'idle' | 'checking' | 'checked' | 'failed';

/**
 * CartReviewStore — when /cart opens, re-reads the items from the server,
 * tells the user about price changes and items no longer sold, and brings
 * the cart up to date, and whether the business paused new orders. Client
 * prices stay informative only.
 */
@Injectable()
export class CartReviewStore {
  private readonly menu = inject(MenuRepository);
  private readonly cart = inject(CartStore);
  private readonly businesses = inject(BusinessRepository);

  private readonly _state = signal<CartReviewState>('idle');
  private readonly _notices = signal<readonly CartNotice[]>([]);
  private readonly _paused = signal(false);

  public readonly state = this._state.asReadonly();
  public readonly notices = this._notices.asReadonly();
  /** The business paused new orders: "Continuar" is disabled. */
  public readonly paused = this._paused.asReadonly();

  /** Compares the cart with the current menu (prices, availability, pause). */
  public async check(): Promise<void> {
    const items = this.cart.items();
    if (items.length === 0) return;
    this._state.set('checking');
    const businessId = this.cart.businessId();
    const [result, business] = await Promise.all([
      this.menu.getItemsByIds(items.map((item) => item.menuItemId)),
      businessId ? this.businesses.getById(businessId) : Promise.resolve(null),
    ]);
    this._paused.set(BusinessPause.isPaused(business?.data?.orders_paused_until));
    if (!result.data) {
      this._state.set('failed');
      return;
    }
    const review = CartReviewer.reviewCart(items, result.data);
    this._notices.set(review.notices);
    this.cart.reconcile(review.prices);
    this._state.set('checked');
  }
}
