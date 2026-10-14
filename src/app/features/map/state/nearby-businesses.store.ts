import { Injectable, PendingTasks, computed, inject, signal } from '@angular/core';
import { BusinessRatingProvider } from '@shared/business/data/business-rating.provider';
import type { BusinessRating } from '@shared/business/data/business-rating.provider';
import { BusinessRepository } from '@shared/business/data/business.repository';
import type { Business, BusinessStatus } from '@shared/business/models/business.model';
import { getBusinessStatus } from '@shared/business/utils/business-status.util';
import { NEARBY_RADIUS_KM } from '../map.constants';
import { BusinessHoursCacheService } from '../services/business-hours-cache.service';
import { GeolocationService } from '../services/geolocation.service';
import { extractCategories, filterBusinesses } from '../utils/business-filter.util';
import { haversineKm } from '../utils/haversine.util';

/** A nearby business ready to render: status, distance and rating resolved. */
export interface NearbyBusiness {
  business: Business;
  status: BusinessStatus;
  /** Straight-line km from the user; null until their location is known. */
  distanceKm: number | null;
  rating: BusinessRating | null;
}

/**
 * NearbyBusinessesStore — state of the map screen: businesses loaded around
 * the map centre plus the client-side search and category filters.
 */
@Injectable()
export class NearbyBusinessesStore {
  private readonly repo = inject(BusinessRepository);
  private readonly hoursCache = inject(BusinessHoursCacheService);
  private readonly ratings = inject(BusinessRatingProvider);
  private readonly geo = inject(GeolocationService);
  /** Keeps the app "unstable" while loading, so tests and SSR wait for data. */
  private readonly pendingTasks = inject(PendingTasks);

  private readonly businesses = signal<Business[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _errorKey = signal<string | null>(null);

  readonly query = signal('');
  readonly category = signal<string | null>(null);
  readonly loading = this._loading.asReadonly();
  readonly errorKey = this._errorKey.asReadonly();

  readonly categories = computed(() => extractCategories(this.businesses()));
  readonly filtersActive = computed(() => this.query().trim() !== '' || this.category() !== null);
  readonly items = computed(() =>
    filterBusinesses(this.businesses(), this.query(), this.category())
      .map((business) => this.toNearby(business))
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)),
  );
  readonly empty = computed(
    () => this._loaded() && !this._loading() && !this._errorKey() && this.items().length === 0,
  );

  /** Loads active businesses around a point and warms the hours cache. */
  async load(lat: number, lng: number): Promise<void> {
    this._loading.set(true);
    this._errorKey.set(null);
    const done = this.pendingTasks.add();
    try {
      const result = await this.repo.getNearby(lat, lng, NEARBY_RADIUS_KM);
      if (result.errorKey || !result.data) {
        this._errorKey.set(result.errorKey ?? 'map.errorLoading');
        return;
      }
      await this.hoursCache.prefetch(result.data.map((b) => b.id));
      this.businesses.set(result.data);
      this._loaded.set(true);
    } finally {
      this._loading.set(false);
      done();
    }
  }

  clearFilters(): void {
    this.query.set('');
    this.category.set(null);
  }

  private toNearby(business: Business): NearbyBusiness {
    const coords = this.geo.coords();
    return {
      business,
      status: getBusinessStatus(this.hoursCache.get(business.id)),
      distanceKm: this.geo.hasRealLocation()
        ? haversineKm(coords.lat, coords.lng, business.latitude, business.longitude)
        : null,
      rating: this.ratings.getRating(business.id),
    };
  }
}
