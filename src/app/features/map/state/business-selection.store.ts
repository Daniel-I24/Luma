import { Injectable, computed, inject, signal } from '@angular/core';
import { BusinessHoursCacheService } from '../services/business-hours-cache.service';
import { MapMarkerSyncService } from '../services/map-marker-sync.service';
import type { NearbyBusiness } from './nearby-businesses.store';

/**
 * BusinessSelectionStore — the business shown in the map's bottom sheet:
 * which one is selected, its promotion and today's hours (already loaded
 * with the nearby list) and the highlighted marker.
 */
@Injectable()
export class BusinessSelectionStore {
  private readonly hoursCache = inject(BusinessHoursCacheService);
  private readonly markerSync = inject(MapMarkerSyncService);

  private readonly _selected = signal<NearbyBusiness | null>(null);
  private readonly _open = signal(false);

  readonly selected = this._selected.asReadonly();
  readonly open = this._open.asReadonly();
  readonly selectedId = computed(() => this._selected()?.business.id ?? null);
  readonly promotion = computed(() => this._selected()?.promotion ?? null);
  readonly hours = computed(() => {
    const id = this.selectedId();
    return id ? this.hoursCache.get(id) : [];
  });

  /** Opens the sheet for a business and highlights its marker. */
  select(item: NearbyBusiness): void {
    this._selected.set(item);
    this._open.set(true);
    this.markerSync.select(item.business.id);
  }

  close(): void {
    this._open.set(false);
    this.markerSync.select(null);
  }
}
