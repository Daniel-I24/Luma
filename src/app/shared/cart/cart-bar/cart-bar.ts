import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { LumaIcon } from '@design-system';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { CartFlight } from '../cart-flight.service';
import { CartStore } from '../cart.store';

/** Screens that already show the cart, where the bar would be redundant. */
const HIDDEN_ON = ['/cart', '/checkout'];

/** CartBar — "Ver carrito · $X" above the tab bar while the cart has items. */
@Component({
  selector: 'app-cart-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaIcon, CopCurrencyPipe],
  template: `
    @if (visible()) {
    <div *transloco="let t" class="bg-canvas px-4 pt-2 pb-2" animate.enter="motion-enter-fade">
      <a
        routerLink="/cart"
        class="pressable flex min-h-12 items-center gap-3 rounded-lg bg-primary px-4 text-primary-fg no-underline shadow-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      >
        <app-luma-icon name="receipt" />
        <span class="flex-1 text-title">{{ t('cart.bar.view', { count: cart.units() }) }}</span>
        <span class="text-title">{{ cart.totalCop() | cop }}</span>
      </a>
    </div>
    }
  `,
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

  constructor() {
    // The bar is where an added dish flies to (CartFlight).
    const flight = inject(CartFlight);
    flight.setTarget(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);
    inject(DestroyRef).onDestroy(() => flight.setTarget(null));
  }
}
