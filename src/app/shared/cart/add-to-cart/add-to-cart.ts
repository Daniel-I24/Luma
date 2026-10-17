import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaIconButton } from '@design-system';
import { CartActions } from '../cart-actions.service';
import { MAX_PER_ITEM, type CartProduct } from '../cart.model';
import { CartStore } from '../cart.store';

/**
 * AddToCart — "Agregar" for one product, then a − / quantity / + stepper
 * once it is in the cart.
 */
@Component({
  selector: 'app-add-to-cart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaIconButton],
  templateUrl: './add-to-cart.html',
  host: { class: 'inline-flex' },
})
export class AddToCart {
  private readonly cart = inject(CartStore);
  private readonly actions = inject(CartActions);

  readonly product = input.required<CartProduct>();

  protected readonly quantity = computed(() => this.cart.quantityOf(this.product().menuItemId));
  protected readonly atLimit = computed(() => this.quantity() >= MAX_PER_ITEM);

  protected add(): void {
    this.actions.add(this.product());
  }

  protected decrease(): void {
    this.cart.setQuantity(this.product().menuItemId, this.quantity() - 1);
  }
}
