import { Injectable, inject, signal } from '@angular/core';
import { NativeHaptics } from '@core/native/native-haptics';
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
  private readonly haptics = inject(NativeHaptics);
  private readonly _pending = signal<readonly CartProduct[] | null>(null);

  /** Products waiting for the user to confirm emptying the cart. */
  public readonly pendingConflict = this._pending.asReadonly();

  public add(product: CartProduct): void {
    this.addAll([product]);
  }

  /** Adds several products of one business (e.g. a combo) as one action. */
  public addAll(products: readonly CartProduct[]): void {
    const businessId = this.cart.businessId();
    if (businessId && products.some((p) => p.businessId !== businessId)) {
      this._pending.set(products);
      return;
    }
    this.addEach(products);
  }

  public confirmReplace(): void {
    const products = this._pending();
    this._pending.set(null);
    if (!products) return;
    this.cart.clear();
    this.addEach(products);
  }

  public cancelReplace(): void {
    this._pending.set(null);
  }

  private addEach(products: readonly CartProduct[]): void {
    const outcomes = products.map((product) => this.cart.add(product));
    if (outcomes.includes('added')) void this.haptics.tap();
    if (outcomes.includes('limit')) {
      this.toasts.show({ messageKey: 'cart.errors.limit', tone: 'error' });
    }
  }
}
