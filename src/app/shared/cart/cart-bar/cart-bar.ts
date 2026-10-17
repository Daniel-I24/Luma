import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { LumaIcon } from '@design-system';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { CartStore } from '../cart.store';

/** Screens that already show the cart, where the bar would be redundant. */
const HIDDEN_ON = ['/cart', '/checkout'];

/** CartBar — "Ver carrito · $X" above the tab bar while the cart has items. */
@Component({
  selector: 'app-cart-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaIcon, CopCurrencyPipe],
  templateUrl: './cart-bar.html',
  host: { class: 'block' },
})
export class CartBar {
  protected readonly cart = inject(CartStore);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly visible = computed(
    () => !this.cart.isEmpty() && !HIDDEN_ON.some((path) => this.url().startsWith(path)),
  );
}
