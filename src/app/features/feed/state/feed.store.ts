import { Injectable, computed, inject, signal } from '@angular/core';
import { BusinessHighlightsRepository } from '@shared/business/data/business-highlights.repository';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { MenuRepository } from '@shared/business/data/menu.repository';
import type { Business } from '@shared/business/models/business.model';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { Haversine } from '@shared/geo/distance';
import type { FeedCard } from '../models/feed-card.model';
import { FeedCards } from '../utils/feed-cards';

/** Same search radius as the map. */
const FEED_RADIUS_KM = 10;
/** Businesses whose posts are fetched per page (three `in` queries per page). */
const FEED_BATCH_SIZE = 4;

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
  /** Businesses already taken from the queue (what a refresh rebuilds). */
  private consumed = 0;

  public readonly cards = this._cards.asReadonly();
  public readonly state = this._state.asReadonly();
  public readonly loadingMore = this._loadingMore.asReadonly();
  public readonly moreFailed = this._moreFailed.asReadonly();
  public readonly hasMore = this._hasMore.asReadonly();
  public readonly empty = computed(() => this._state() === 'ready' && this._cards().length === 0);

  /** (Re)loads the feed from the first page. */
  public async load(): Promise<void> {
    this._state.set('loading');
    this._cards.set([]);
    const { lat, lng } = this.geo.coords();
    const nearby = await this.businessRepo.getNearby(lat, lng, FEED_RADIUS_KM);
    if (!nearby.data) {
      this._state.set('error');
      return;
    }
    const km = (b: Business): number => Haversine.haversineKm(lat, lng, b.latitude, b.longitude);
    this.queue = [...nearby.data].sort((a, b) => km(a) - km(b));
    this.consumed = 0;
    this._hasMore.set(this.queue.length > 0);
    const loaded = await this.loadUntilSomethingNew();
    this._state.set(loaded ? 'ready' : 'error');
  }

  /**
   * After a change on another phone: rebuilds, in one go, as many businesses
   * as are shown and swaps the posts at once (no loading state; cards keep
   * their ids, so unchanged ones do not move). A failure keeps what is shown.
   */
  public async refresh(): Promise<void> {
    if (this._state() !== 'ready') return this.load();
    const { lat, lng } = this.geo.coords();
    const nearby = await this.businessRepo.getNearby(lat, lng, FEED_RADIUS_KM);
    if (!nearby.data) return;
    const km = (b: Business): number => Haversine.haversineKm(lat, lng, b.latitude, b.longitude);
    const sorted = [...nearby.data].sort((a, b) => km(a) - km(b));
    const shown = sorted.slice(0, Math.max(this.consumed, FEED_BATCH_SIZE));
    // The same batches as when they were loaded, so the cards keep their order.
    const batches = Array.from({ length: Math.ceil(shown.length / FEED_BATCH_SIZE) }, (_, i) =>
      this.cardsOf(shown.slice(i * FEED_BATCH_SIZE, (i + 1) * FEED_BATCH_SIZE)));
    const parts = await Promise.all(batches);
    if (parts.some((part) => part === null)) return;
    const cards = parts.flatMap((part) => part ?? []);
    this.queue = sorted.slice(shown.length);
    this.consumed = shown.length;
    this._hasMore.set(this.queue.length > 0);
    this._cards.set(cards);
  }

  /** Appends the next batch; called when the end of the feed comes near. */
  public async loadMore(): Promise<void> {
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
    const cards = await this.cardsOf(batch);
    if (!cards) return false;
    this.queue = this.queue.slice(batch.length);
    this.consumed += batch.length;
    this._hasMore.set(this.queue.length > 0);
    this._cards.update((current) => [...current, ...cards]);
    return true;
  }

  /** The posts of these businesses; null when a request failed. */
  private async cardsOf(businesses: readonly Business[]): Promise<FeedCard[] | null> {
    const ids = businesses.map((b) => b.id);
    const [hours, promotions, menu] = await Promise.all([
      this.businessRepo.getHoursFor(ids),
      this.highlights.getActivePromotions(ids),
      this.menuRepo.getAvailableFor(ids),
    ]);
    if (!promotions.data || !menu.data) return null;
    return FeedCards.buildFeedCards({
      businesses: [...businesses],
      // Without hours every business shows as closed rather than failing the page.
      hours: hours.data ?? [],
      promotions: promotions.data,
      menuItems: menu.data,
      distanceKm: (b) => this.distanceKm(b),
    });
  }

  private distanceKm(business: Business): number | null {
    if (!this.geo.hasRealLocation()) return null;
    const { lat, lng } = this.geo.coords();
    return Haversine.haversineKm(lat, lng, business.latitude, business.longitude);
  }
}
