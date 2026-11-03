import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessHighlightsRepository } from '@shared/business/data/business-highlights.repository';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { MenuRepository } from '@shared/business/data/menu.repository';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { FeedStore } from './feed.store';

const business = (n: number) => ({ id: `b${n}`, name: `Negocio ${n}`, category: 'Bar', latitude: 1.21 + n / 1000, longitude: -77.28 });
const dish = (n: number, price: number) => ({ id: `m${n}`, business_id: `b${n}`, name: `Plato ${n}`, price_cop: price, is_available: true });

describe('FeedStore.refresh', () => {
  const repo = { getNearby: vi.fn(), getHoursFor: vi.fn() };
  const highlights = { getActivePromotions: vi.fn() };
  const menu = { getAvailableFor: vi.fn() };

  beforeEach(() => {
    repo.getNearby.mockResolvedValue({ data: [business(1), business(2)], errorKey: null });
    repo.getHoursFor.mockResolvedValue({ data: [], errorKey: null });
    highlights.getActivePromotions.mockResolvedValue({ data: [], errorKey: null });
    menu.getAvailableFor.mockResolvedValue({ data: [dish(1, 1000), dish(2, 2000)], errorKey: null });
    TestBed.configureTestingModule({
      providers: [
        FeedStore,
        { provide: BusinessRepository, useValue: repo },
        { provide: BusinessHighlightsRepository, useValue: highlights },
        { provide: MenuRepository, useValue: menu },
        { provide: GeolocationService, useValue: { coords: signal({ lat: 1.21, lng: -77.28 }), hasRealLocation: signal(false) } },
      ],
    });
  });

  it('swaps the changed posts at once, without a loading state, keeping their order', async () => {
    const store = TestBed.inject(FeedStore);
    await store.load();
    const before = store.cards().map((c) => c.id);
    menu.getAvailableFor.mockResolvedValue({ data: [dish(1, 1500), dish(2, 2000)], errorKey: null });
    const states: string[] = [];
    const pending = store.refresh();
    states.push(store.state());
    await pending;
    expect(states).toEqual(['ready']);
    expect(store.cards().map((c) => c.id)).toEqual(before);
    expect(store.cards().find((c) => c.id === 'dish:m1')?.priceCop).toBe(1500);
  });

  it('a refresh that fails keeps what is shown', async () => {
    const store = TestBed.inject(FeedStore);
    await store.load();
    const before = store.cards();
    menu.getAvailableFor.mockResolvedValue({ data: null, errorKey: 'x' });
    await store.refresh();
    expect(store.cards()).toBe(before);
    expect(store.state()).toBe('ready');
  });
});
