import { Injectable, computed, inject, signal } from '@angular/core';
import { BusinessRepository } from '@shared/business/data/business.repository';
import type { Business, BusinessHours, BusinessStatus } from '@shared/business/models/business.model';
import { getBusinessStatus } from '@shared/business/utils/business-status.util';
import { FavoritesStore } from '@shared/favorites/favorites.store';

export interface FavoriteBusiness {
  business: Business;
  status: BusinessStatus;
}

export type FavoritesPageState = 'loading' | 'ready' | 'error';

/**
 * FavoritesPageStore — "Mis favoritos": the businesses behind the user's
 * favourite ids (one `in` query, plus one for their hours). The list follows
 * FavoritesStore, so removing a heart takes the card away at once.
 */
@Injectable()
export class FavoritesPageStore {
  private readonly repo = inject(BusinessRepository);
  private readonly favorites = inject(FavoritesStore);

  private readonly _state = signal<FavoritesPageState>('loading');
  private readonly loaded = signal<ReadonlyMap<string, FavoriteBusiness>>(new Map());

  readonly state = this._state.asReadonly();
  /** In FavoritesStore order, only those still marked. */
  readonly items = computed(() =>
    [...this.favorites.ids()]
      .map((id) => this.loaded().get(id))
      .filter((item): item is FavoriteBusiness => item !== undefined),
  );

  /** Call once FavoritesStore is ready (its ids are known). */
  async load(): Promise<void> {
    this._state.set('loading');
    if (this.favorites.failed()) {
      this._state.set('error');
      return;
    }
    const ids = [...this.favorites.ids()];
    const [businesses, hours] = await Promise.all([
      this.repo.getByIds(ids),
      this.repo.getHoursFor(ids),
    ]);
    if (!businesses.data) {
      this._state.set('error');
      return;
    }
    const schedule = hours.data ?? [];
    this.loaded.set(
      new Map(businesses.data.map((b) => [b.id, { business: b, status: statusOf(b, schedule) }])),
    );
    this._state.set('ready');
  }
}

function statusOf(business: Business, hours: readonly BusinessHours[]): BusinessStatus {
  return getBusinessStatus(hours.filter((h) => h.business_id === business.id));
}
