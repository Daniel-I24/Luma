import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { BUSINESS_CATEGORIES } from '@shared/business/data/business-categories';
import { DEAL_SORTS, type DealSort, MIN_DISCOUNTS } from '@shared/promotions/deal-list.util';
import { PromotionsStore } from '../../state/promotions.store';

const SELECT_CLASS =
  'min-h-11 rounded-md border border-border bg-surface px-2 text-body-sm text-fg focus-visible:outline-2 focus-visible:outline-border-focus';
const CHIP_CLASS =
  'min-h-11 shrink-0 cursor-pointer rounded-full border px-3 text-body-sm focus-visible:outline-2 focus-visible:outline-border-focus';

/** PromotionFilters — order, category, minimum discount and "abierto ahora". */
@Component({
  selector: 'app-promotion-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
  templateUrl: './promotion-filters.html',
})
export class PromotionFilters {
  protected readonly store = inject(PromotionsStore);
  protected readonly categories = BUSINESS_CATEGORIES;
  protected readonly sorts = DEAL_SORTS;
  protected readonly minDiscounts = MIN_DISCOUNTS;
  protected readonly selectClass = SELECT_CLASS;
  protected readonly chipClass = CHIP_CLASS;

  protected onSort(event: Event): void {
    this.store.sort.set((event.target as HTMLSelectElement).value as DealSort);
  }

  protected onMinDiscount(event: Event): void {
    this.store.setFilter('minDiscount', Number((event.target as HTMLSelectElement).value));
  }

  protected toggleCategory(value: string): void {
    this.store.setFilter('category', this.store.filters().category === value ? null : value);
  }
}
