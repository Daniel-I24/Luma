import { Injectable, inject, signal } from '@angular/core';
import { ToastService } from '@design-system/toast/toast.service';
import type { CartProduct } from './cart.model';
import { CartStore } from './cart.store';

/**
 * CartActions — what "Agregar" does anywhere in the app: adds to the cart,
 * reports the limits and, when the product belongs to another business,
 * asks (CartConflictSheet) whether to empty the cart first.
 */
@Injectable({ providedIn: 'root' })
export class CartActions {
  private readonly cart = inject(CartStore);
  private readonly toasts = inject(ToastService);
  private readonly _pending = signal<CartProduct | null>(null);

  /** Product waiting for the user to confirm emptying the cart. */
  readonly pendingConflict = this._pending.asReadonly();

  add(product: CartProduct): void {
    const outcome = this.cart.add(product);
    if (outcome === 'conflict') this._pending.set(product);
    if (outcome === 'limit') this.toasts.show({ messageKey: 'cart.errors.limit', tone: 'error' });
  }

  confirmReplace(): void {
    const product = this._pending();
    this._pending.set(null);
    if (product) this.cart.replaceWith(product);
  }

  cancelReplace(): void {
    this._pending.set(null);
  }
}
