import { Injectable, PendingTasks, computed, inject, signal } from '@angular/core';
import type { IconName } from '@design-system';
import { BusinessHighlightsRepository } from '@shared/business/data/business-highlights.repository';
import { BusinessRepository } from '@shared/business/data/business.repository';
import type { Business, BusinessStatus, Promotion } from '@shared/business/models/business.model';
import type { BusinessRating } from '@shared/business/models/review.model';
import { getBusinessStatus } from '@shared/business/utils/business-status.util';
import { NEARBY_RADIUS_KM } from '../map.constants';
import { BusinessHoursCacheService } from '../services/business-hours-cache.service';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { extractCategories, filterBusinesses } from '../utils/business-filter.util';
import { categoryIcon } from '@shared/business/utils/category-icon.util';
import { haversineKm } from '@shared/geo/haversine.util';

/** A nearby business ready to render: status, distance and highlights resolved. */
export interface NearbyBusiness {
  business: Business;
  status: BusinessStatus;
  /** Straight-line km from the user; null until their location is known. */
  distanceKm: number | null;
  /** Null when the business has no reviews or ratings could not be loaded. */
  rating: BusinessRating | null;
  /** True when ratings loaded, so a null rating really means "no reviews". */
  ratingsLoaded: boolean;
  /** First active promotion, if any. */
  promotion: Promotion | null;
  /** Stands in for a missing logo, from the business category. */
  logoIcon: IconName;
}

/**
 * NearbyBusinessesStore — state of the map screen: businesses loaded around
 * the map centre, their ratings and promotions (one query each for all of
 * them) and the client-side search and category filters.
 */
@Injectable()
export class NearbyBusinessesStore {
  private readonly repo = inject(BusinessRepository);
  private readonly highlights = inject(BusinessHighlightsRepository);
  private readonly hoursCache = inject(BusinessHoursCacheService);
  private readonly geo = inject(GeolocationService);
  /** Keeps the app "unstable" while loading, so tests and SSR wait for data. */
  private readonly pendingTasks = inject(PendingTasks);

  private readonly businesses = signal<Business[]>([]);
  /** Null when the ratings request failed (ratings unknown). */
  private readonly ratings = signal<Map<string, BusinessRating> | null>(null);
  private readonly promotions = signal(new Map<string, Promotion>());
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

  /** Loads active businesses around a point, then their hours, ratings and promotions. */
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
      const ids = result.data.map((b) => b.id);
      const [, ratings, promotions] = await Promise.all([
        this.hoursCache.prefetch(ids),
        this.highlights.getRatings(ids),
        this.highlights.getActivePromotions(ids),
      ]);
      // Ratings and promotions are extras: if they fail the map still works.
      this.ratings.set(ratings.data);
      this.promotions.set(firstPerBusiness(promotions.data ?? []));
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
    const ratings = this.ratings();
    return {
      business,
      status: getBusinessStatus(this.hoursCache.get(business.id)),
      distanceKm: this.geo.hasRealLocation()
        ? haversineKm(coords.lat, coords.lng, business.latitude, business.longitude)
        : null,
      rating: ratings?.get(business.id) ?? null,
      ratingsLoaded: ratings !== null,
      promotion: this.promotions().get(business.id) ?? null,
      logoIcon: categoryIcon(business.category),
    };
  }
}

function firstPerBusiness(promotions: readonly Promotion[]): Map<string, Promotion> {
  const byBusiness = new Map<string, Promotion>();
  for (const promo of promotions) {
    if (!byBusiness.has(promo.business_id)) byBusiness.set(promo.business_id, promo);
  }
  return byBusiness;
}
