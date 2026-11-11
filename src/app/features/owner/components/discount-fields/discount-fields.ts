import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaInput, LumaSelect, type SelectOption } from '@design-system';
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
  imports: [TranslocoModule, LumaInput, LumaSelect, CopCurrencyPipe],
  template: `
    <fieldset *transloco="let t" class="m-0 flex flex-col gap-3 border-0 p-0">
      <legend class="mb-1 p-0 text-label-lg text-fg">{{ t('owner.discount.legend') }}</legend>
      <app-luma-select
        selectId="promo-item"
        [label]="t('owner.discount.item')"
        [placeholder]="t('owner.discount.noItem')"
        [options]="itemOptions()"
        [errorMessage]="itemError() ?? undefined"
        [value]="itemId() ?? ''"
        (valueChange)="onItem($event)"
      />
      @if (item()) {
      <app-luma-input
        inputId="promo-percent"
        [placeholder]="t('placeholders.percent')"
        inputMode="numeric"
        [digitsOnly]="true"
        [maxLength]="2"
        [label]="t('owner.discount.percent')"
        [hint]="t('owner.discount.percentHint')"
        [errorMessage]="percentError()"
        [value]="percent()"
        (valueChange)="percent.set($event)"
      />
      <p class="m-0 rounded-md bg-surface-selected p-3 text-body-sm text-fg" aria-live="polite">
        @if (preview(); as price) { {{ t('owner.discount.preview', { final: (price.final | cop), list:
        (price.list | cop) }) }} } @else { {{ t('owner.discount.previewEmpty') }} }
      </p>
      <p class="m-0 text-caption text-fg-muted">{{ t('owner.discount.margin') }}</p>
      }
    </fieldset>
  `,
})
export class DiscountFields {
  public readonly items = input.required<readonly MenuItem[]>();
  /** Already translated errors of menu_item_id and discount_percent. */
  public readonly itemError = input<string | undefined>(undefined);
  public readonly percentError = input<string | undefined>(undefined);
  public readonly itemId = model<string | null>(null);
  public readonly percent = model('');

  protected readonly itemOptions = computed<SelectOption[]>(() => this.items().map((i) => ({ value: i.id, label: i.name })));
  protected readonly item = computed(
    () => this.items().find((i) => i.id === this.itemId()) ?? null,
  );
  protected readonly preview = computed(() => {
    const item = this.item();
    const percent = Number(this.percent());
    if (!item || !NumberSpecs.discount.isSatisfiedBy(percent)) return null;
    return { list: item.price_cop, final: PromotionPricing.promotionPrice(item.price_cop, percent) };
  });

  protected onItem(value: string): void {
    this.itemId.set(value || null);
    if (!value) this.percent.set('');
  }
}
