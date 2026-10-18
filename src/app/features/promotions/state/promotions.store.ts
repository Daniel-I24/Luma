import { Injectable, computed, inject, signal } from '@angular/core';
import { GeolocationService } from '@shared/geo/geolocation.service';
import {
  type DealFilters,
  type DealSort,
  NO_DEAL_FILTERS,
  arrangeDeals,
} from '@shared/promotions/deal-list.util';
import {
  type DealWithHours,
  PromotionDealRepository,
} from '@shared/promotions/promotion-deal.repository';

export type DealsState = 'loading' | 'ready' | 'error';

/** PromotionsStore — current deals near the user, filtered and sorted. */
@Injectable()
export class PromotionsStore {
  private readonly repo = inject(PromotionDealRepository);
  private readonly geo = inject(GeolocationService);

  private readonly _state = signal<DealsState>('loading');
  private readonly _deals = signal<readonly DealWithHours[]>([]);
  private readonly _errorKey = signal<string | null>(null);

  readonly state = this._state.asReadonly();
  readonly errorKey = this._errorKey.asReadonly();
  readonly sort = signal<DealSort>('distance');
  readonly filters = signal<DealFilters>(NO_DEAL_FILTERS);
  readonly hasFilters = computed(() => this.filters() !== NO_DEAL_FILTERS);

  /** Deals in display order; recomputed when filters, sort or location change. */
  readonly listed = computed(() =>
    arrangeDeals(this._deals(), {
      sort: this.sort(),
      filters: this.filters(),
      origin: this.geo.coords(),
      now: new Date(),
    }),
  );

  async load(): Promise<void> {
    this._state.set('loading');
    const result = await this.repo.listCurrent();
    if (!result.data) {
      this._errorKey.set(result.errorKey);
      this._state.set('error');
      return;
    }
    this._deals.set(result.data);
    this._state.set('ready');
  }

  setFilter<K extends keyof DealFilters>(key: K, value: DealFilters[K]): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
  }

  clearFilters(): void {
    this.filters.set(NO_DEAL_FILTERS);
  }
}
