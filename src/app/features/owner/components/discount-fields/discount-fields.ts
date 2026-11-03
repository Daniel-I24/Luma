import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaInput } from '@design-system';
import type { MenuItem } from '@shared/business/models/menu.model';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { PromotionPricing } from '@shared/promotions/promotion-deal';
import { NumberSpecs } from '@core/validation/number-rules';

/**
 * DiscountFields — optional product of the promotion and its percent off,
 * with the final price customers will see (the server applies it).
 */
@Component({
  selector: 'app-discount-fields',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaInput, CopCurrencyPipe],
  templateUrl: './discount-fields.html',
})
export class DiscountFields {
  public readonly items = input.required<readonly MenuItem[]>();
  /** Already translated errors of menu_item_id and discount_percent. */
  public readonly itemError = input<string | undefined>(undefined);
  public readonly percentError = input<string | undefined>(undefined);
  public readonly itemId = model<string | null>(null);
  public readonly percent = model('');

  protected readonly item = computed(
    () => this.items().find((i) => i.id === this.itemId()) ?? null,
  );
  protected readonly preview = computed(() => {
    const item = this.item();
    const percent = Number(this.percent());
    if (!item || !NumberSpecs.discount.isSatisfiedBy(percent)) return null;
    return { list: item.price_cop, final: PromotionPricing.promotionPrice(item.price_cop, percent) };
  });

  protected onItem(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.itemId.set(value || null);
    if (!value) this.percent.set('');
  }
}
