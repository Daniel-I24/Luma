import { Injectable, PendingTasks, computed, inject, signal } from '@angular/core';
import { BusinessHighlightsRepository } from '@shared/business/data/business-highlights.repository';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { MenuRepository } from '@shared/business/data/menu.repository';
import type { Business, BusinessHours } from '@shared/business/models/business.model';
import type { MenuItem } from '@shared/business/models/menu.model';
import type { BusinessRating } from '@shared/business/models/review.model';
import { BusinessStatusRules } from '@shared/business/domain/opening-hours';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { Haversine } from '@shared/geo/distance';
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

  public readonly state = this._state.asReadonly();
  public readonly business = this._business.asReadonly();
  public readonly hours = this._hours.asReadonly();
  public readonly rating = this._rating.asReadonly();
  public readonly ratingsLoaded = this._ratingsLoaded.asReadonly();
  public readonly promotions = this._promotions.asReadonly();
  /** "Recomendada por Luma IA": the biggest discount on an available item (none without discounts). */
  public readonly recommendedDealId = computed(
    () =>
      [...this._promotions()]
        .filter((deal) => deal.discountPercent !== null && deal.item?.available)
        .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))[0]?.id ?? null,
  );
  /** Null when the menu could not be loaded. */
  public readonly menu = this._menu.asReadonly();
  public readonly status = computed(() => BusinessStatusRules.getBusinessStatus(this._hours()));
  public readonly distanceKm = computed(() => {
    const business = this._business();
    if (!business || !this.geo.hasRealLocation()) return null;
    const { lat, lng } = this.geo.coords();
    return Haversine.haversineKm(lat, lng, business.latitude, business.longitude);
  });

  /** Loads a business with its menu, promotions, hours and photos. */
  public async load(id: string): Promise<void> {
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

  /**
   * After a change on another phone (name, hours, pause, menu, prices,
   * sold out, promotions): re-reads it without a loading state; a part that
   * fails keeps what is shown, and a business no longer public is "notFound".
   */
  public async refresh(): Promise<void> {
    const current = this._business();
    if (!current || this._state() !== 'ready') return;
    const result = await this.businesses.getById(current.id);
    if (result.errorKey) return;
    if (!result.data) return this._state.set('notFound');
    await this.loadDetails(result.data, true);
  }

  /** Re-reads the rating after the user wrote, edited or deleted a review. */
  public async refreshRating(): Promise<void> {
    const business = this._business();
    if (!business) return;
    const ratings = await this.highlights.getRatings([business.id]);
    if (ratings.data) this._rating.set(ratings.data.get(business.id) ?? null);
  }

  private async loadDetails(business: Business, keepOnFailure = false): Promise<void> {
    const [hours, ratings, promotions, menu] = await Promise.all([
      this.businesses.getHours(business.id),
      this.highlights.getRatings([business.id]),
      this.deals.listForBusiness(business.id),
      this.menuRepo.getMenu(business.id),
    ]);
    this._business.set(business);
    // A refresh keeps the parts that failed to load again.
    const take = (data: unknown): boolean => !keepOnFailure || data !== null;
    if (take(hours.data)) this._hours.set(hours.data ?? []);
    if (take(ratings.data)) this.setRating(business.id, ratings.data);
    if (take(promotions.data)) this._promotions.set(promotions.data?.map((entry) => entry.deal) ?? []);
    if (take(menu.data)) this._menu.set(menu.data);
  }

  private setRating(id: string, ratings: ReadonlyMap<string, BusinessRating> | null): void {
    this._rating.set(ratings?.get(id) ?? null);
    this._ratingsLoaded.set(ratings !== null);
  }
}
