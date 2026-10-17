import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { type UserScopedState, UserDataRegistry } from '@core/auth/user-data-registry';
import { CartStorage } from './cart-storage';
import {
  type CartItem,
  type CartProduct,
  type CartSnapshot,
  EMPTY_CART,
  MAX_CART_UNITS,
  MAX_PER_ITEM,
  cartTotal,
  cartUnits,
} from './cart.model';

/** added · conflict: the cart holds another business · limit: 20 per item or 50 in total. */
export type AddOutcome = 'added' | 'conflict' | 'limit';

/**
 * CartStore — the signed-in user's cart, client side only (prices are
 * informative; the server recalculates them). One business per cart,
 * persisted per user and wiped on sign-out or account deletion.
 */
@Injectable({ providedIn: 'root' })
export class CartStore implements UserScopedState {
  private readonly storage = inject(CartStorage);
  private readonly auth = inject(AuthService);
  private readonly _cart = signal<CartSnapshot>(EMPTY_CART);
  private owner: string | null = null;

  readonly items = computed(() => this._cart().items);
  readonly businessName = computed(() => this._cart().businessName);
  readonly businessId = computed(() => this._cart().items[0]?.businessId ?? null);
  readonly units = computed(() => cartUnits(this.items()));
  readonly totalCop = computed(() => cartTotal(this.items()));
  readonly isEmpty = computed(() => this.items().length === 0);

  constructor() {
    inject(UserDataRegistry).register(this);
    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      untracked(() => this.switchUser(userId));
    });
  }

  quantityOf(menuItemId: string): number {
    return this.items().find((item) => item.menuItemId === menuItemId)?.quantity ?? 0;
  }

  add(product: CartProduct): AddOutcome {
    const businessId = this.businessId();
    if (businessId && businessId !== product.businessId) return 'conflict';
    const current = this.quantityOf(product.menuItemId);
    if (current >= MAX_PER_ITEM || this.units() >= MAX_CART_UNITS) return 'limit';
    if (current === 0) {
      const { businessName, ...line } = product;
      this.commit({ businessName, items: [...this.items(), { ...line, quantity: 1 }] });
    } else {
      this.setQuantity(product.menuItemId, current + 1);
    }
    return 'added';
  }

  /** Empties the cart and adds the product (answer to a conflict). */
  replaceWith(product: CartProduct): AddOutcome {
    this.commit(EMPTY_CART);
    return this.add(product);
  }

  /** Sets a line's quantity within the limits; 0 removes it. */
  setQuantity(menuItemId: string, quantity: number): void {
    const others = cartUnits(this.items().filter((i) => i.menuItemId !== menuItemId));
    const allowed = Math.max(0, Math.min(Math.trunc(quantity), MAX_PER_ITEM, MAX_CART_UNITS - others));
    const items = this.items()
      .map((item) => (item.menuItemId === menuItemId ? { ...item, quantity: allowed } : item))
      .filter((item) => item.quantity > 0);
    this.commit({ businessName: items.length ? this.businessName() : null, items });
  }

  remove(menuItemId: string): void {
    this.setQuantity(menuItemId, 0);
  }

  /** Applies the server's current prices and drops lines no longer sold. */
  reconcile(prices: ReadonlyMap<string, number>): void {
    const items: CartItem[] = this.items()
      .filter((item) => prices.has(item.menuItemId))
      .map((item) => ({ ...item, priceCop: prices.get(item.menuItemId) ?? item.priceCop }));
    this.commit({ businessName: items.length ? this.businessName() : null, items });
  }

  clear(): void {
    this.commit(EMPTY_CART);
  }

  clearUserData(): void {
    if (this.owner) this.storage.remove(this.owner);
    this.owner = null;
    this._cart.set(EMPTY_CART);
  }

  private switchUser(userId: string | null): void {
    if (userId === this.owner) return;
    this.owner = userId;
    this._cart.set(userId ? this.storage.load(userId) : EMPTY_CART);
  }

  private commit(cart: CartSnapshot): void {
    this._cart.set(cart);
    if (this.owner) this.storage.save(this.owner, cart);
  }
}
