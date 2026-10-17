import { Injectable, computed, inject, signal } from '@angular/core';
import { BusinessHighlightsRepository } from '@shared/business/data/business-highlights.repository';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { MenuRepository } from '@shared/business/data/menu.repository';
import type { Business } from '@shared/business/models/business.model';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { haversineKm } from '@shared/geo/haversine.util';
import type { FeedCard } from '../models/feed-card.model';
import { buildFeedCards } from '../utils/feed-cards.util';

/** Same search radius as the map. */
export const FEED_RADIUS_KM = 10;
/** Businesses whose posts are fetched per page (three `in` queries per page). */
export const FEED_BATCH_SIZE = 4;

export type FeedState = 'loading' | 'ready' | 'error';

/**
 * FeedStore — posts of the /feed screen: nearby businesses (user location or
 * Pasto centre), then their promotions and dishes a batch of businesses at a
 * time, appended as the user scrolls.
 */
@Injectable()
export class FeedStore {
  private readonly businessRepo = inject(BusinessRepository);
  private readonly highlights = inject(BusinessHighlightsRepository);
  private readonly menuRepo = inject(MenuRepository);
  private readonly geo = inject(GeolocationService);

  private readonly _cards = signal<readonly FeedCard[]>([]);
  private readonly _state = signal<FeedState>('loading');
  private readonly _loadingMore = signal(false);
  private readonly _moreFailed = signal(false);
  private readonly _hasMore = signal(false);
  private queue: Business[] = [];

  readonly cards = this._cards.asReadonly();
  readonly state = this._state.asReadonly();
  readonly loadingMore = this._loadingMore.asReadonly();
  readonly moreFailed = this._moreFailed.asReadonly();
  readonly hasMore = this._hasMore.asReadonly();
  readonly empty = computed(() => this._state() === 'ready' && this._cards().length === 0);

  /** (Re)loads the feed from the first page. */
  async load(): Promise<void> {
    this._state.set('loading');
    this._cards.set([]);
    const { lat, lng } = this.geo.coords();
    const nearby = await this.businessRepo.getNearby(lat, lng, FEED_RADIUS_KM);
    if (!nearby.data) {
      this._state.set('error');
      return;
    }
    const km = (b: Business) => haversineKm(lat, lng, b.latitude, b.longitude);
    this.queue = [...nearby.data].sort((a, b) => km(a) - km(b));
    this._hasMore.set(this.queue.length > 0);
    const loaded = await this.loadUntilSomethingNew();
    this._state.set(loaded ? 'ready' : 'error');
  }

  /** Appends the next batch; called when the end of the feed comes near. */
  async loadMore(): Promise<void> {
    if (this._loadingMore() || !this.hasMore() || this._state() !== 'ready') return;
    this._loadingMore.set(true);
    this._moreFailed.set(false);
    const loaded = await this.loadUntilSomethingNew();
    this._moreFailed.set(!loaded);
    this._loadingMore.set(false);
  }

  /** Skips batches without posts so the end-of-feed sentinel never stalls. */
  private async loadUntilSomethingNew(): Promise<boolean> {
    const before = this._cards().length;
    while (this._hasMore() && this._cards().length === before) {
      if (!(await this.loadNextBatch())) return false;
    }
    return true;
  }

  /** Fetches the posts of the next businesses; false when a request failed. */
  private async loadNextBatch(): Promise<boolean> {
    const batch = this.queue.slice(0, FEED_BATCH_SIZE);
    const ids = batch.map((b) => b.id);
    const [hours, promotions, menu] = await Promise.all([
      this.businessRepo.getHoursFor(ids),
      this.highlights.getActivePromotions(ids),
      this.menuRepo.getAvailableFor(ids),
    ]);
    if (!promotions.data || !menu.data) return false;

    const cards = buildFeedCards({
      businesses: batch,
      // Without hours every business shows as closed rather than failing the page.
      hours: hours.data ?? [],
      promotions: promotions.data,
      menuItems: menu.data,
      distanceKm: (b) => this.distanceKm(b),
    });
    this.queue = this.queue.slice(batch.length);
    this._hasMore.set(this.queue.length > 0);
    this._cards.update((current) => [...current, ...cards]);
    return true;
  }

  private distanceKm(business: Business): number | null {
    if (!this.geo.hasRealLocation()) return null;
    const { lat, lng } = this.geo.coords();
    return haversineKm(lat, lng, business.latitude, business.longitude);
  }
}
