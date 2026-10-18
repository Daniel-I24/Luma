import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaButton, LumaIcon } from '@design-system';
import { CartActions } from '@shared/cart/cart-actions.service';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { DistancePipe } from '@shared/geo/distance.pipe';
import { type PromotionDeal, endsIn } from '../promotion-deal';

/**
 * PromotionCard — one deal: discount badge, struck list price and final
 * price, business, distance, when it ends and "Pedir" (adds the item to the
 * cart; the server charges its own price). Used by /promotions and by the
 * Promos tab of a restaurant.
 */
@Component({
  selector: 'app-promotion-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaButton, LumaIcon, CopCurrencyPipe, DistancePipe],
  templateUrl: './promotion-card.html',
  host: { class: 'block' },
})
export class PromotionCard {
  private readonly cart = inject(CartActions);
  private readonly transloco = inject(TranslocoService);
  /** Active language, for the distance format. */
  protected readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly deal = input.required<PromotionDeal>();
  readonly distanceKm = input<number | null>(null);
  /** Hidden inside the restaurant's own profile. */
  readonly showBusiness = input(true);
  /** "Recomendada por Luma IA" (the promotion that best fits the moment). */
  readonly recommended = input(false);

  protected readonly endsLabel = computed(() => {
    const ends = endsIn(this.deal().endsAt, new Date());
    return {
      key: `promotions.card.${ends.key}`,
      params: ends.key === 'endsInDays' ? { days: ends.days } : {},
    };
  });
  protected readonly canOrder = computed(() => !!this.deal().item?.available);

  protected order(): void {
    const { item, business } = this.deal();
    if (!item) return;
    this.cart.add({
      menuItemId: item.id,
      businessId: business.id,
      businessName: business.name,
      name: item.name,
      priceCop: item.finalCop,
    });
  }
}
