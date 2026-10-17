import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaIcon } from '@design-system';
import { CartActions } from '@shared/cart/cart-actions.service';
import { toCartProduct } from '@shared/cart/cart.model';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import type { Combo, ComboRole } from '@shared/recommendations/recommendation.model';

const ROLES: readonly ComboRole[] = ['main', 'side', 'drink'];

/** ComboCard — main + side + drink of one business, total and "add to cart". */
@Component({
  selector: 'app-combo-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaIcon, CopCurrencyPipe],
  template: `
    <section
      *transloco="let t"
      class="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-card"
      aria-labelledby="combo-heading"
    >
      <header class="flex items-center gap-2">
        <app-luma-icon class="text-fg-accent" name="sparkles" />
        <h2 id="combo-heading" class="m-0 text-title text-fg">
          {{ t('ai.combo.title', { name: combo().business.name }) }}
        </h2>
      </header>
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        @for (role of roles; track role) {
          <li class="flex items-baseline justify-between gap-3">
            <span class="flex min-w-0 flex-col">
              <span class="text-caption text-fg-subtle">{{ t('ai.combo.roles.' + role) }}</span>
              <span class="text-body text-fg">{{ combo().items[role].name }}</span>
            </span>
            <span class="text-body text-fg-muted">{{ combo().items[role].price_cop | cop }}</span>
          </li>
        }
      </ul>
      <p class="m-0 flex items-center justify-between border-t border-border-subtle pt-3">
        <span class="text-title text-fg">{{ t('ai.combo.total') }}</span>
        <span class="text-price text-fg">{{ combo().totalCop | cop }}</span>
      </p>
      <app-luma-button variant="accent" [fullWidth]="true" (clicked)="addToCart()">{{
        t('ai.combo.add')
      }}</app-luma-button>
    </section>
  `,
})
export class ComboCard {
  private readonly cart = inject(CartActions);

  readonly combo = input.required<Combo>();

  protected readonly roles = ROLES;
  private readonly products = computed(() =>
    ROLES.map((role) => toCartProduct(this.combo().items[role], this.combo().business.name)),
  );

  protected addToCart(): void {
    this.cart.addAll(this.products());
  }
}
