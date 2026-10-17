import { Injectable, inject, signal } from '@angular/core';
import { ToastService } from '@design-system/toast/toast.service';
import type { CartProduct } from './cart.model';
import { CartStore } from './cart.store';

/**
 * CartActions — what "Agregar" does anywhere in the app: adds to the cart,
 * reports the limits and, when the products belong to another business,
 * asks (CartConflictSheet) whether to empty the cart first.
 */
@Injectable({ providedIn: 'root' })
export class CartActions {
  private readonly cart = inject(CartStore);
  private readonly toasts = inject(ToastService);
  private readonly _pending = signal<readonly CartProduct[] | null>(null);

  /** Products waiting for the user to confirm emptying the cart. */
  readonly pendingConflict = this._pending.asReadonly();

  add(product: CartProduct): void {
    this.addAll([product]);
  }

  /** Adds several products of one business (e.g. a combo) as one action. */
  addAll(products: readonly CartProduct[]): void {
    const businessId = this.cart.businessId();
    if (businessId && products.some((p) => p.businessId !== businessId)) {
      this._pending.set(products);
      return;
    }
    this.addEach(products);
  }

  confirmReplace(): void {
    const products = this._pending();
    this._pending.set(null);
    if (!products) return;
    this.cart.clear();
    this.addEach(products);
  }

  cancelReplace(): void {
    this._pending.set(null);
  }

  private addEach(products: readonly CartProduct[]): void {
    const outcomes = products.map((product) => this.cart.add(product));
    if (outcomes.includes('limit')) {
      this.toasts.show({ messageKey: 'cart.errors.limit', tone: 'error' });
    }
  }
}
