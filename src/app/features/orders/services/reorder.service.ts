import { Injectable, inject } from '@angular/core';
import { CartStore } from '@shared/cart/cart.store';
import type { OrderWithItems } from '@shared/orders/order.model';

/**
 * ReorderService — "Pedir de nuevo": puts the lines of a past order back in
 * the cart (replacing whatever was there). Prices are the ones of the old
 * order only as a hint: the cart review re-reads the menu and the server
 * prices the new order; items no longer on the menu are flagged there.
 */
@Injectable({ providedIn: 'root' })
export class ReorderService {
  private readonly cart = inject(CartStore);

  /** False when there is nothing to reorder (business gone or no menu items left). */
  public canReorder(order: OrderWithItems): boolean {
    return order.business_id !== null && order.items.some((item) => item.menu_item_id !== null);
  }

  /** Resolves to false when nothing could be added. */
  public reorder(order: OrderWithItems): boolean {
    const businessId = order.business_id;
    if (!businessId || !this.canReorder(order)) return false;
    this.cart.clear();
    for (const item of order.items) {
      if (!item.menu_item_id) continue;
      const added = this.cart.add({
        menuItemId: item.menu_item_id,
        businessId,
        businessName: order.business_name,
        name: item.name,
        priceCop: item.unit_price_cop,
      });
      if (added === 'added') this.cart.setQuantity(item.menu_item_id, item.quantity);
    }
    return !this.cart.isEmpty();
  }
}
