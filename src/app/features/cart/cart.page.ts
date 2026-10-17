import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaEmptyState, LumaIconButton } from '@design-system';
import { AddToCart } from '@shared/cart/add-to-cart/add-to-cart';
import type { CartProduct } from '@shared/cart/cart.model';
import { CartStore } from '@shared/cart/cart.store';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { CartReviewStore } from './state/cart-review.store';

/**
 * CartPage — /cart: editable lines, total and "Continuar". On opening, the
 * items are re-read from the server and any price change or item no longer
 * sold is reported (and applied) before continuing.
 */
@Component({
  selector: 'app-cart-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaEmptyState, LumaIconButton, AddToCart, CopCurrencyPipe],
  providers: [CartReviewStore],
  templateUrl: './cart.page.html',
  host: { class: 'block' },
})
export class CartPage {
  protected readonly cart = inject(CartStore);
  protected readonly review = inject(CartReviewStore);
  private readonly router = inject(Router);

  /** Lines as products, for the quantity steppers. */
  protected readonly products = computed(
    () =>
      new Map<string, CartProduct>(
        this.cart.items().map((item) => [
          item.menuItemId,
          { ...item, businessName: this.cart.businessName() ?? '' },
        ]),
      ),
  );

  constructor() {
    void this.review.check();
  }

  protected go(path: '/map' | '/checkout'): void {
    void this.router.navigate([path]);
  }
}
