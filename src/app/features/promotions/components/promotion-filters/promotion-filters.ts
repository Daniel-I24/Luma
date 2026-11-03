import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaChip, LumaSelect, type SelectOption } from '@design-system';
import { BUSINESS_CATEGORIES } from '@shared/business/data/business-categories';
import { DEAL_SORTS, type DealSort, MIN_DISCOUNTS } from '@shared/promotions/deal-list';
import { PromotionsStore } from '../../state/promotions.store';

/** PromotionFilters — order, category, minimum discount and "abierto ahora". */
@Component({
  selector: 'app-promotion-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaChip, LumaSelect],
  template: `
    <section
      *transloco="let t"
      class="flex flex-col gap-3"
      [attr.aria-label]="t('promotions.filters.label')"
    >
      <div class="grid grid-cols-2 gap-2">
        <app-luma-select
          selectId="promo-sort"
          [hint]="t('placeholders.sortHint')"
          [label]="t('promotions.filters.sort')"
          [options]="sortOptions()"
          [value]="store.sort()"
          (valueChange)="onSort($event)"
        />
        <app-luma-select
          selectId="promo-min"
          [hint]="t('placeholders.minDiscountHint')"
          [label]="t('promotions.filters.minDiscount')"
          [options]="discountOptions()"
          [value]="minDiscount()"
          (valueChange)="onMinDiscount($event)"
        />
      </div>
      <div
        class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
        role="group"
        [attr.aria-label]="t('promotions.filters.category')"
      >
        <app-luma-chip
          class="shrink-0"
          icon="clock"
          [selected]="store.filters().openNow"
          (selectedChange)="store.setFilter('openNow', $event)"
          >{{ t('promotions.filters.openNow') }}</app-luma-chip
        >
        @for (category of categories; track category.value) {
        <app-luma-chip
          class="shrink-0"
          [selected]="store.filters().category === category.value"
          (selectedChange)="toggleCategory(category.value)"
          >{{ t('businessCategories.' + category.key) }}</app-luma-chip
        >
        }
      </div>
    </section>
  `,
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
