import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessHighlightsRepository } from '@shared/business/data/business-highlights.repository';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { MenuRepository } from '@shared/business/data/menu.repository';
import type { Business } from '@shared/business/models/business.model';
import { GeolocationService, PASTO_CENTRE } from '@shared/geo/geolocation.service';
import { FEED_BATCH_SIZE, FeedStore } from './feed.store';
import { useFixedClock } from '../../../../testing/fixed-clock';

const business = (n: number) =>
  ({ id: `b${n}`, name: `B${n}`, category: 'Cafetería', latitude: PASTO_CENTRE.lat + n / 1000, longitude: PASTO_CENTRE.lng }) as Business;
const dishFor = (business_id: string) =>
  ({ id: `d-${business_id}`, business_id, name: 'Plato', price_cop: 1000, sort_order: 1, is_available: true });
const ok = <T>(data: T) => Promise.resolve({ data, errorKey: null });

describe('FeedStore', () => {
  useFixedClock();

  const businesses = { getNearby: vi.fn(), getHoursFor: vi.fn() };
  const highlights = { getActivePromotions: vi.fn() };
  const menu = { getAvailableFor: vi.fn() };
  let store: FeedStore;

  beforeEach(() => {
    vi.clearAllMocks();
    const all = [6, 1, 3, 2, 5, 4].map(business);
    businesses.getNearby.mockReturnValue(ok(all));
    businesses.getHoursFor.mockReturnValue(ok([]));
    highlights.getActivePromotions.mockReturnValue(ok([]));
    menu.getAvailableFor.mockImplementation((ids: string[]) => ok(ids.map(dishFor)));
    TestBed.configureTestingModule({
      providers: [
        FeedStore,
        { provide: BusinessRepository, useValue: businesses },
        { provide: BusinessHighlightsRepository, useValue: highlights },
        { provide: MenuRepository, useValue: menu },
        GeolocationService,
      ],
    });
    store = TestBed.inject(FeedStore);
  });

  it('loads nearby businesses around Pasto and the first batch, nearest first, with one query per table', async () => {
    await store.load();

    expect(businesses.getNearby).toHaveBeenCalledWith(PASTO_CENTRE.lat, PASTO_CENTRE.lng, 10);
    expect(menu.getAvailableFor).toHaveBeenCalledOnce();
    expect(menu.getAvailableFor).toHaveBeenCalledWith(['b1', 'b2', 'b3', 'b4']);
    expect(highlights.getActivePromotions).toHaveBeenCalledWith(['b1', 'b2', 'b3', 'b4']);
    expect(store.state()).toBe('ready');
    expect(store.cards()).toHaveLength(FEED_BATCH_SIZE);
    expect(store.hasMore()).toBe(true);
  });

  it('appends the next batch and stops when every business was shown', async () => {
    await store.load();
    await store.loadMore();

    expect(menu.getAvailableFor).toHaveBeenLastCalledWith(['b5', 'b6']);
    expect(store.cards().map((c) => c.business.id)).toEqual(['b1', 'b2', 'b3', 'b4', 'b5', 'b6']);
    expect(store.hasMore()).toBe(false);

    await store.loadMore();
    expect(menu.getAvailableFor).toHaveBeenCalledTimes(2);
  });

  it('keeps fetching past batches without posts so paging never stalls', async () => {
    menu.getAvailableFor.mockImplementationOnce(() => ok([]));

    await store.load();

    expect(menu.getAvailableFor).toHaveBeenCalledTimes(2);
    expect(store.cards().map((c) => c.business.id)).toEqual(['b5', 'b6']);
  });

  it('shows the error state when the first page fails, and empty when there is nothing', async () => {
    businesses.getNearby.mockReturnValueOnce(Promise.resolve({ data: null, errorKey: 'x' }));
    await store.load();
    expect(store.state()).toBe('error');

    businesses.getNearby.mockReturnValueOnce(ok([]));
    await store.load();
    expect(store.empty()).toBe(true);
  });

  it('flags a failed next page without losing the loaded posts', async () => {
    await store.load();
    highlights.getActivePromotions.mockReturnValueOnce(Promise.resolve({ data: null, errorKey: 'x' }));

    await store.loadMore();

    expect(store.moreFailed()).toBe(true);
    expect(store.cards()).toHaveLength(FEED_BATCH_SIZE);
    expect(store.state()).toBe('ready');
  });
});
