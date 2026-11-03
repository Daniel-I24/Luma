import { Injectable, computed, inject, signal } from '@angular/core';
import { type Place, type PlaceAttribution, PlaceSearchRepository } from '../services/place-search.repository';

export const MIN_PLACE_QUERY = 3;

/**
 * PlaceSearchStore — neighbourhoods, addresses and places for the map
 * search. Asked only when the user submits (Enter or "Buscar lugares"), never
 * per keystroke: this respects the providers' policies and the daily quota.
 * Businesses keep filtering live in NearbyBusinessesStore.
 */
@Injectable()
export class PlaceSearchStore {
  private readonly repo = inject(PlaceSearchRepository);

  private readonly _places = signal<readonly Place[] | null>(null);
  private readonly _attribution = signal<PlaceAttribution>(null);
  private readonly _loading = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  private readonly _searched = signal('');
  private request = 0;

  readonly places = this._places.asReadonly();
  /** Credit shown under the results when the provider's terms ask for it. */
  readonly attribution = this._attribution.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly errorKey = this._errorKey.asReadonly();
  /** The query the shown results belong to. */
  readonly searched = this._searched.asReadonly();
  readonly open = computed(() => this._loading() || this._places() !== null || this._errorKey() !== null);

  canSearch(query: string): boolean {
    return query.trim().length >= MIN_PLACE_QUERY;
  }

  async search(query: string, near: { lat: number; lng: number }): Promise<void> {
    const q = query.trim();
    if (!this.canSearch(q) || (q === this._searched() && this._places() !== null)) return;
    const id = ++this.request;
    this._loading.set(true);
    this._errorKey.set(null);
    this._searched.set(q);
    const result = await this.repo.search(q, near);
    if (id !== this.request) return;
    this._places.set(result.places);
    this._attribution.set(result.attribution ?? null);
    this._errorKey.set(result.errorKey);
    this._loading.set(false);
  }

  /** Closes the results (a place was chosen, or the query changed or was cleared). */
  close(): void {
    this.request++;
    this._places.set(null);
    this._errorKey.set(null);
    this._loading.set(false);
    this._searched.set('');
  }
}
