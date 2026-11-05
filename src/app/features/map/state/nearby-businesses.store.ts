import { Injectable, PendingTasks, computed, inject, signal } from '@angular/core';
import { ErrorLog } from '@core/errors/error-log';
import type { IconName } from '@design-system';
import { BusinessHighlightsRepository } from '@shared/business/data/business-highlights.repository';
import { BusinessRepository } from '@shared/business/data/business.repository';
import type { Business, BusinessStatus, Promotion } from '@shared/business/models/business.model';
import type { BusinessRating } from '@shared/business/models/review.model';
import { BusinessStatusRules } from '@shared/business/domain/opening-hours';
import { NEARBY_RADIUS_KM } from '../map.constants';
import { BusinessHoursCacheService } from '../services/business-hours-cache.service';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { BusinessFilter } from '../utils/business-filter';
import { PromotionPick } from '../utils/promotion-pick';
import { type MapFilters, NO_FILTERS, MapFilterRules } from '../utils/map-filter-rules';
import { CategoryIcons } from '@shared/business/utils/category-icons';
import { Haversine } from '@shared/geo/distance';

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
  /** Active promotion to show (biggest discount first), if any. */
  promotion: Promotion | null;
  /** Stands in for a missing logo, from the business category. */
  logoIcon: IconName;
}

/**
 * NearbyBusinessesStore — state of the map screen: businesses loaded around
 * the map centre, their ratings and promotions (one query each for all of
 * them) and the client-side search and filters (open now, promotion,
 * rating, distance and categories).
 */
@Injectable()
export class NearbyBusinessesStore {
  private readonly repo = inject(BusinessRepository);
  private readonly highlights = inject(BusinessHighlightsRepository);
  private readonly hoursCache = inject(BusinessHoursCacheService);
  private readonly geo = inject(GeolocationService);
  private readonly log = inject(ErrorLog);
  /** Keeps the app "unstable" while loading, so tests and SSR wait for data. */
  private readonly pendingTasks = inject(PendingTasks);

  private readonly businesses = signal<Business[]>([]);
  /** Null when the ratings request failed (ratings unknown). */
  private readonly ratings = signal<Map<string, BusinessRating> | null>(null);
  private readonly promotions = signal(new Map<string, Promotion>());
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  private last: { readonly lat: number; readonly lng: number } | null = null;

  public readonly query = signal('');
  public readonly filters = signal<MapFilters>(NO_FILTERS);
  public readonly loading = this._loading.asReadonly();
  public readonly errorKey = this._errorKey.asReadonly();

  public readonly categories = computed(() => BusinessFilter.extractCategories(this.businesses()));
  public readonly filterCount = computed(() => MapFilterRules.activeFilterCount(this.filters()));
  public readonly filtersActive = computed(() => this.query().trim() !== '' || this.filterCount() > 0);
  /** Distance can only be filtered once the user's location is known. */
  public readonly canFilterDistance = this.geo.hasRealLocation;
  public readonly items = computed(() =>
    MapFilterRules.applyMapFilters(
      BusinessFilter.filterBusinesses(this.businesses(), this.query()).map((business) => this.toNearby(business)),
      this.filters(),
    ).sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)),
  );
  public readonly empty = computed(
    () => this._loaded() && !this._loading() && !this._errorKey() && this.items().length === 0,
  );

  /**
   * Loads active businesses around a point, then their hours, ratings and
   * promotions. `silent` (a change on another phone): no loading state, and a
   * failure keeps what is shown.
   */
  public async load(lat: number, lng: number, silent = false): Promise<void> {
    this.last = { lat, lng };
    if (!silent) {
      this._loading.set(true);
      this._errorKey.set(null);
    }
    const done = this.pendingTasks.add();
    try {
      const result = await this.repo.getNearby(lat, lng, NEARBY_RADIUS_KM);
      if (result.errorKey || !result.data) {
        if (!silent) this._errorKey.set(result.errorKey ?? 'map.errorLoading');
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
      this.promotions.set(PromotionPick.firstPerBusiness(promotions.data ?? []));
      this.businesses.set(result.data);
      this._loaded.set(true);
    } catch (error) {
      this.log.record(error, 'map');
      if (!silent) this._errorKey.set('businesses.errors.service');
    } finally {
      this._loading.set(false);
      done();
    }
  }

  /** Re-reads the same area after changes elsewhere; their hours are read again. */
  public async refresh(changedIds: readonly string[] = []): Promise<void> {
    if (!this.last) return;
    this.hoursCache.forget(changedIds);
    await this.load(this.last.lat, this.last.lng, true);
  }

  /** Removes every map filter. */
  public clearFilters(): void {
    this.query.set('');
    this.filters.set(NO_FILTERS);
  }

  private toNearby(business: Business): NearbyBusiness {
    const coords = this.geo.coords();
    const ratings = this.ratings();
    return {
      business,
      status: BusinessStatusRules.getBusinessStatus(this.hoursCache.get(business.id)),
      distanceKm: this.geo.hasRealLocation()
        ? Haversine.haversineKm(coords.lat, coords.lng, business.latitude, business.longitude)
        : null,
      rating: ratings?.get(business.id) ?? null,
      ratingsLoaded: ratings !== null,
      promotion: this.promotions().get(business.id) ?? null,
      logoIcon: CategoryIcons.categoryIcon(business.category),
    };
  }
}
