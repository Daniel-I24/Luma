import { Injectable, PendingTasks, computed, inject, signal } from '@angular/core';
import { BusinessHighlightsRepository } from '@shared/business/data/business-highlights.repository';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { MenuRepository } from '@shared/business/data/menu.repository';
import type { Business, BusinessHours } from '@shared/business/models/business.model';
import type { MenuItem } from '@shared/business/models/menu.model';
import type { BusinessRating } from '@shared/business/models/review.model';
import { getBusinessStatus } from '@shared/business/utils/business-status.util';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { haversineKm } from '@shared/geo/haversine.util';
import type { PromotionDeal } from '@shared/promotions/promotion-deal';
import { PromotionDealRepository } from '@shared/promotions/promotion-deal.repository';

export type ProfileState = 'loading' | 'ready' | 'notFound' | 'error';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * BusinessProfileStore — data of one business profile: the business, then
 * its hours, rating, promotions and menu in parallel. A malformed or unknown
 * id ends in "notFound" without a server error.
 */
@Injectable()
export class BusinessProfileStore {
  private readonly businesses = inject(BusinessRepository);
  private readonly highlights = inject(BusinessHighlightsRepository);
  private readonly deals = inject(PromotionDealRepository);
  private readonly menuRepo = inject(MenuRepository);
  private readonly geo = inject(GeolocationService);
  private readonly pendingTasks = inject(PendingTasks);

  private readonly _state = signal<ProfileState>('loading');
  private readonly _business = signal<Business | null>(null);
  private readonly _hours = signal<BusinessHours[]>([]);
  private readonly _rating = signal<BusinessRating | null>(null);
  private readonly _ratingsLoaded = signal(false);
  private readonly _promotions = signal<PromotionDeal[]>([]);
  private readonly _menu = signal<MenuItem[] | null>(null);

  readonly state = this._state.asReadonly();
  readonly business = this._business.asReadonly();
  readonly hours = this._hours.asReadonly();
  readonly rating = this._rating.asReadonly();
  readonly ratingsLoaded = this._ratingsLoaded.asReadonly();
  readonly promotions = this._promotions.asReadonly();
  /** Null when the menu could not be loaded. */
  readonly menu = this._menu.asReadonly();
  readonly status = computed(() => getBusinessStatus(this._hours()));
  readonly distanceKm = computed(() => {
    const business = this._business();
    if (!business || !this.geo.hasRealLocation()) return null;
    const { lat, lng } = this.geo.coords();
    return haversineKm(lat, lng, business.latitude, business.longitude);
  });

  async load(id: string): Promise<void> {
    if (!UUID.test(id)) {
      this._state.set('notFound');
      return;
    }
    this._state.set('loading');
    const done = this.pendingTasks.add();
    try {
      const result = await this.businesses.getById(id);
      if (result.errorKey) return this._state.set('error');
      if (!result.data) return this._state.set('notFound');
      await this.loadDetails(result.data);
      this._state.set('ready');
    } finally {
      done();
    }
  }

  /** Re-reads the rating after the user wrote, edited or deleted a review. */
  async refreshRating(): Promise<void> {
    const business = this._business();
    if (!business) return;
    const ratings = await this.highlights.getRatings([business.id]);
    if (ratings.data) this._rating.set(ratings.data.get(business.id) ?? null);
  }

  private async loadDetails(business: Business): Promise<void> {
    const [hours, ratings, promotions, menu] = await Promise.all([
      this.businesses.getHours(business.id),
      this.highlights.getRatings([business.id]),
      this.deals.listForBusiness(business.id),
      this.menuRepo.getMenu(business.id),
    ]);
    this._business.set(business);
    this._hours.set(hours.data ?? []);
    this._rating.set(ratings.data?.get(business.id) ?? null);
    this._ratingsLoaded.set(ratings.data !== null);
    this._promotions.set(promotions.data?.map((entry) => entry.deal) ?? []);
    this._menu.set(menu.data);
  }
}
