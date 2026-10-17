import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessHighlightsRepository } from '@shared/business/data/business-highlights.repository';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { MenuRepository } from '@shared/business/data/menu.repository';
import { FavoritesStore } from '@shared/favorites/favorites.store';
import { RECOMMENDATION_ENGINE } from '@shared/recommendations/recommendation-engine';
import type { RecommendationRequest } from '@shared/recommendations/recommendation.model';
import { AiStore } from './ai.store';

const allDay = (business_id: string) =>
  [0, 1, 2, 3, 4, 5, 6].map((d) => ({ business_id, day_of_week: d, opens_at: '00:00', closes_at: '23:59', is_closed: false }));
const ok = <T>(data: T) => Promise.resolve({ data, errorKey: null });

describe('AiStore', () => {
  const businesses = { getNearby: vi.fn(), getHoursFor: vi.fn() };
  const highlights = { getRatings: vi.fn(), getActivePromotions: vi.fn() };
  const menus = { getAvailableFor: vi.fn() };
  const engine = { recommend: vi.fn() };
  let store: AiStore;

  beforeEach(() => {
    vi.clearAllMocks();
    businesses.getNearby.mockReturnValue(ok([{ id: 'b1', name: 'Café', category: 'Cafetería', latitude: 1, longitude: 2 }]));
    businesses.getHoursFor.mockReturnValue(ok(allDay('b1')));
    highlights.getRatings.mockReturnValue(ok(new Map([['b1', { businessId: 'b1', rating: 4.5, reviewCount: 3 }]])));
    highlights.getActivePromotions.mockReturnValue(ok([{ business_id: 'b1' }]));
    menus.getAvailableFor.mockReturnValue(ok([{ id: 'm1', business_id: 'b1' }]));
    engine.recommend.mockResolvedValue({ businesses: [], combo: null });
    TestBed.configureTestingModule({
      providers: [
        AiStore,
        { provide: BusinessRepository, useValue: businesses },
        { provide: BusinessHighlightsRepository, useValue: highlights },
        { provide: MenuRepository, useValue: menus },
        { provide: FavoritesStore, useValue: { ids: signal(new Set(['b1'])) } },
        { provide: RECOMMENDATION_ENGINE, useValue: engine },
      ],
    });
    store = TestBed.inject(AiStore);
  });

  it('builds candidates with one query per table and asks the engine', async () => {
    await store.load();

    expect(businesses.getHoursFor).toHaveBeenCalledWith(['b1']);
    expect(menus.getAvailableFor).toHaveBeenCalledWith(['b1']);
    const request = engine.recommend.mock.calls[0][0] as RecommendationRequest;
    expect(request.moment).toBe(store.moment());
    expect(request.candidates[0]).toMatchObject({
      status: 'open',
      rating: 4.5,
      hasPromotion: true,
      isFavorite: true,
      distanceKm: null,
      menu: [{ id: 'm1', business_id: 'b1' }],
    });
    expect(store.state()).toBe('ready');
  });

  it('re-asks the engine when the moment changes, without reloading data', async () => {
    await store.load();
    await store.selectMoment('dinner');

    expect(engine.recommend).toHaveBeenLastCalledWith(expect.objectContaining({ moment: 'dinner' }));
    expect(businesses.getNearby).toHaveBeenCalledOnce();
  });

  it('fails when businesses or hours cannot load, degrades without ratings', async () => {
    highlights.getRatings.mockReturnValue(Promise.resolve({ data: null, errorKey: 'x' }));
    await store.load();
    expect(store.state()).toBe('ready');

    businesses.getHoursFor.mockReturnValue(Promise.resolve({ data: null, errorKey: 'x' }));
    await store.load();
    expect(store.state()).toBe('error');
  });
});
