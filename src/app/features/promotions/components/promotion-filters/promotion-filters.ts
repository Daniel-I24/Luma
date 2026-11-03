import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaChip, LumaSelect, type SelectOption } from '@design-system';
import { BUSINESS_CATEGORIES } from '@shared/business/data/business-categories';
import { DEAL_SORTS, type DealSort, MIN_DISCOUNTS } from '@shared/promotions/deal-list.util';
import { PromotionsStore } from '../../state/promotions.store';

/** PromotionFilters — order, category, minimum discount and "abierto ahora". */
@Component({
  selector: 'app-promotion-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaChip, LumaSelect],
  templateUrl: './promotion-filters.html',
})
export class PromotionFilters {
  protected readonly store = inject(PromotionsStore);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  protected readonly categories = BUSINESS_CATEGORIES;
  protected readonly sortOptions = computed<SelectOption[]>(() => {
    this.lang();
    return DEAL_SORTS.map((sort) => ({ value: sort, label: this.transloco.translate(`promotions.sort.${sort}`) }));
  });
  protected readonly discountOptions = computed<SelectOption[]>(() => {
    this.lang();
    return MIN_DISCOUNTS.map((min) => ({
      value: String(min),
      label: min
        ? this.transloco.translate('promotions.filters.atLeast', { percent: min })
        : this.transloco.translate('promotions.filters.anyDiscount'),
    }));
  });
  protected readonly minDiscount = computed(() => String(this.store.filters().minDiscount));

  protected onSort(value: string): void {
    this.store.sort.set(value as DealSort);
  }

  protected onMinDiscount(value: string): void {
    this.store.setFilter('minDiscount', Number(value));
  }

  protected toggleCategory(value: string): void {
    this.store.setFilter('category', this.store.filters().category === value ? null : value);
  }
}
