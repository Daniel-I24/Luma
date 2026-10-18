import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaInput } from '@design-system';
import type { MenuItem } from '@shared/business/models/menu.model';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { promotionPrice } from '@shared/promotions/promotion-deal';

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
  readonly items = input.required<readonly MenuItem[]>();
  /** Already translated errors of menu_item_id and discount_percent. */
  readonly itemError = input<string | undefined>(undefined);
  readonly percentError = input<string | undefined>(undefined);
  readonly itemId = model<string | null>(null);
  readonly percent = model('');

  protected readonly item = computed(
    () => this.items().find((i) => i.id === this.itemId()) ?? null,
  );
  protected readonly preview = computed(() => {
    const item = this.item();
    const percent = Number(this.percent());
    if (!item || !Number.isInteger(percent) || percent < 5 || percent > 90) return null;
    return { list: item.price_cop, final: promotionPrice(item.price_cop, percent) };
  });

  protected onItem(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.itemId.set(value || null);
    if (!value) this.percent.set('');
  }
}
