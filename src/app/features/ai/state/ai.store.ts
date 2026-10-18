import { Injectable, inject, signal } from '@angular/core';
import { BusinessHighlightsRepository } from '@shared/business/data/business-highlights.repository';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { MenuRepository } from '@shared/business/data/menu.repository';
import type { Business, BusinessHours } from '@shared/business/models/business.model';
import { getBusinessStatus } from '@shared/business/utils/business-status.util';
import { FavoritesStore } from '@shared/favorites/favorites.store';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { haversineKm } from '@shared/geo/haversine.util';
import { RECOMMENDATION_ENGINE } from '@shared/recommendations/recommendation-engine';
import type {
  DayMoment,
  Recommendation,
  RecommendationCandidate,
} from '@shared/recommendations/recommendation.model';
import { momentForHour } from '@shared/recommendations/rules-recommendation.engine';

export const AI_RADIUS_KM = 10;
export type AiState = 'loading' | 'ready' | 'error';

/**
 * AiStore — /ai: nearby businesses with their status, rating, promotions
 * and menu (one `in` query per table), handed to the RecommendationEngine
 * for the selected moment of the day (preselected from the current hour).
 */
@Injectable()
export class AiStore {
  private readonly businesses = inject(BusinessRepository);
  private readonly highlights = inject(BusinessHighlightsRepository);
  private readonly menus = inject(MenuRepository);
  private readonly geo = inject(GeolocationService);
  private readonly favorites = inject(FavoritesStore);
  private readonly engine = inject(RECOMMENDATION_ENGINE);

  private readonly _moment = signal<DayMoment>(momentForHour(new Date().getHours()));
  private readonly _state = signal<AiState>('loading');
  private readonly _result = signal<Recommendation | null>(null);
  private candidates: RecommendationCandidate[] = [];
  /** Businesses already shown, left out by "Otra opción". */
  private readonly shown = new Set<string>();

  readonly moment = this._moment.asReadonly();
  readonly state = this._state.asReadonly();
  readonly result = this._result.asReadonly();

  async load(): Promise<void> {
    this._state.set('loading');
    const { lat, lng } = this.geo.coords();
    const nearby = await this.businesses.getNearby(lat, lng, AI_RADIUS_KM);
    const ids = nearby.data?.map((b) => b.id) ?? [];
    const [hours, ratings, promotions, menu] = await Promise.all([
      this.businesses.getHoursFor(ids),
      this.highlights.getRatings(ids),
      this.highlights.getActivePromotions(ids),
      this.menus.getAvailableFor(ids),
    ]);
    if (!nearby.data || !hours.data) {
      this._state.set('error');
      return;
    }
    // Ratings, promotions and menus only refine the result: missing ones count as none.
    const promoted = new Set(promotions.data?.map((p) => p.business_id));
    this.candidates = nearby.data.map((business) => ({
      business,
      status: getBusinessStatus(hoursOf(hours.data ?? [], business)),
      distanceKm: this.distanceKm(business),
      rating: ratings.data?.get(business.id)?.rating ?? null,
      hasPromotion: promoted.has(business.id),
      isFavorite: false,
      menu: (menu.data ?? []).filter((item) => item.business_id === business.id),
    }));
    await this.recommend();
  }

  async selectMoment(moment: DayMoment): Promise<void> {
    this._moment.set(moment);
    this.shown.clear();
    if (this._state() === 'ready') await this.recommend();
  }

  /** "Otra opción": the next best places, without the ones already shown (then from the start). */
  async another(): Promise<void> {
    for (const pick of this._result()?.businesses ?? []) this.shown.add(pick.candidate.business.id);
    if (this.candidates.every((c) => this.shown.has(c.business.id))) this.shown.clear();
    await this.recommend();
  }

  private async recommend(): Promise<void> {
    const favorites = this.favorites.ids();
    const candidates = this.candidates
      .filter((c) => !this.shown.has(c.business.id))
      .map((c) => ({ ...c, isFavorite: favorites.has(c.business.id) }));
    const origin = this.geo.hasRealLocation() ? this.geo.coords() : null;
    try {
      this._result.set(await this.engine.recommend({ moment: this._moment(), candidates, origin }));
      this._state.set('ready');
    } catch {
      this._state.set('error');
    }
  }

  private distanceKm(business: Business): number | null {
    if (!this.geo.hasRealLocation()) return null;
    const { lat, lng } = this.geo.coords();
    return haversineKm(lat, lng, business.latitude, business.longitude);
  }
}

function hoursOf(hours: readonly BusinessHours[], business: Business): BusinessHours[] {
  return hours.filter((h) => h.business_id === business.id);
}
