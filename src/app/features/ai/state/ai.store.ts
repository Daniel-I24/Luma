import { Injectable, computed, inject, signal } from '@angular/core';
import { BusinessHighlightsRepository } from '@shared/business/data/business-highlights.repository';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { MenuRepository } from '@shared/business/data/menu.repository';
import type { Business, BusinessHours } from '@shared/business/models/business.model';
import { BusinessStatusRules } from '@shared/business/domain/opening-hours';
import { FavoritesStore } from '@shared/favorites/favorites.store';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { Haversine } from '@shared/geo/distance';
import { RECOMMENDATION_ENGINE } from '@shared/recommendations/recommendation-engine';
import type {
  DayMoment,
  Recommendation,
  RecommendationCandidate,
} from '@shared/recommendations/recommendation.model';
import { MomentCombos } from '@shared/recommendations/moment-combos';
import { RecommendationScoring } from '@shared/recommendations/rules-recommendation.engine';

const AI_RADIUS_KM = 10;
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

  private readonly _moment = signal<DayMoment>(RecommendationScoring.momentForHour(new Date().getHours()));
  private readonly _state = signal<AiState>('loading');
  private readonly _result = signal<Recommendation | null>(null);
  private readonly _candidates = signal<RecommendationCandidate[]>([]);
  private hoursById = new Map<string, BusinessHours[]>();
  /** Businesses already shown, left out by "Otra opción". */
  private readonly shown = new Set<string>();

  public readonly moment = this._moment.asReadonly();
  public readonly state = this._state.asReadonly();
  public readonly result = this._result.asReadonly();
  /** "Combos para {momento}": open in that window, nearby, ranked like the recommendation. */
  public readonly combos = computed(() =>
    MomentCombos.forMoment(
      this._candidates(),
      this._moment(),
      (c, window) => MomentCombos.openDuringWindow(this.hoursById.get(c.business.id) ?? [], window),
      this._result()?.businesses.map((pick) => pick.candidate.business.id) ?? [],
    ),
  );

  /** Loads recommendations for the selected moment of the day. */
  public async load(): Promise<void> {
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
    this.hoursById = new Map(nearby.data.map((business) => [business.id, hoursOf(hours.data ?? [], business)]));
    this._candidates.set(nearby.data.map((business) => ({
      business,
      status: BusinessStatusRules.getBusinessStatus(hoursOf(hours.data ?? [], business)),
      distanceKm: this.distanceKm(business),
      rating: ratings.data?.get(business.id)?.rating ?? null,
      hasPromotion: promoted.has(business.id),
      isFavorite: false,
      menu: (menu.data ?? []).filter((item) => item.business_id === business.id),
    })));
    await this.recommend();
  }

  /** Switches the moment of the day and reloads. */
  public async selectMoment(moment: DayMoment): Promise<void> {
    this._moment.set(moment);
    this.shown.clear();
    if (this._state() === 'ready') await this.recommend();
  }

  /** "Otra opción": the next best places, without the ones already shown (then from the start). */
  public async another(): Promise<void> {
    for (const pick of this._result()?.businesses ?? []) this.shown.add(pick.candidate.business.id);
    if (this._candidates().every((c) => this.shown.has(c.business.id))) this.shown.clear();
    await this.recommend();
  }

  private async recommend(): Promise<void> {
    const favorites = this.favorites.ids();
    const candidates = this._candidates()
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
    return Haversine.haversineKm(lat, lng, business.latitude, business.longitude);
  }
}

function hoursOf(hours: readonly BusinessHours[], business: Business): BusinessHours[] {
  return hours.filter((h) => h.business_id === business.id);
}
