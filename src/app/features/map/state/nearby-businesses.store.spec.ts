import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessHighlightsRepository } from '@shared/business/data/business-highlights.repository';
import { BusinessRepository } from '@shared/business/data/business.repository';
import type { Business } from '@shared/business/models/business.model';
import { BusinessHoursCacheService } from '../services/business-hours-cache.service';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { NO_FILTERS } from '../utils/map-filters.util';
import { NearbyBusinessesStore } from './nearby-businesses.store';
import { useFixedClock } from '../../../../testing/fixed-clock';

const biz = (id: string, category: string, latitude: number): Business => ({
  id,
  owner_id: 'o',
  name: `Negocio ${id}`,
  description: null,
  category,
  logo_url: null,
  cover_url: null,
  latitude,
  longitude: -77.28,
  address: 'Pasto',
  phone: null,
  is_active: true,
  created_at: '',
  prep_minutes: 20,
  updated_at: '',
});

describe('NearbyBusinessesStore', () => {
  useFixedClock();

  const repo = { getNearby: vi.fn() };
  const highlights = { getRatings: vi.fn(), getActivePromotions: vi.fn() };
  const located = signal(false);
  let store: NearbyBusinessesStore;

  beforeEach(() => {
    vi.clearAllMocks();
    located.set(false);
    repo.getNearby.mockResolvedValue({
      data: [biz('far', 'Pizza', 1.25), biz('near', 'Café', 1.214)],
      errorKey: null,
    });
    highlights.getRatings.mockResolvedValue({
      data: new Map([['far', { businessId: 'far', rating: 4.5, reviewCount: 10 }]]),
      errorKey: null,
    });
    highlights.getActivePromotions.mockResolvedValue({
      data: [
        { id: 'p1', business_id: 'near', title: 'Café gratis' },
        { id: 'p2', business_id: 'near', title: 'Otra' },
      ],
      errorKey: null,
    });
    TestBed.configureTestingModule({
      providers: [
        NearbyBusinessesStore,
        { provide: BusinessRepository, useValue: repo },
        { provide: BusinessHoursCacheService, useValue: { prefetch: vi.fn(), get: () => [] } },
        { provide: BusinessHighlightsRepository, useValue: highlights },
        {
          provide: GeolocationService,
          useValue: { coords: signal({ lat: 1.2136, lng: -77.2811 }), hasRealLocation: located },
        },
      ],
    });
    store = TestBed.inject(NearbyBusinessesStore);
  });

  it('loads businesses with status, rating and categories', async () => {
    await store.load(1.21, -77.28);

    expect(store.items()).toHaveLength(2);
    expect(store.items()[0].status).toBe('closed');
    expect(store.items()[0].rating?.rating).toBe(4.5);
    expect(highlights.getRatings).toHaveBeenCalledExactlyOnceWith(['far', 'near']);
    expect(highlights.getActivePromotions).toHaveBeenCalledExactlyOnceWith(['far', 'near']);
    expect(store.categories()).toEqual(['Café', 'Pizza']);
    expect(store.loading()).toBe(false);
  });

  it('sorts by distance once the user is located', async () => {
    located.set(true);
    await store.load(1.21, -77.28);

    expect(store.items().map((i) => i.business.id)).toEqual(['near', 'far']);
    expect(store.items()[0].distanceKm).toBeLessThan(1);
  });

  it('keeps distance unknown without the user location', async () => {
    await store.load(1.21, -77.28);

    expect(store.items()[0].distanceKm).toBeNull();
  });

  it('filters by query and by the sheet filters on the client and can clear them', async () => {
    await store.load(1.21, -77.28);

    store.filters.set({ ...NO_FILTERS, categories: ['Pizza'] });
    expect(store.items().map((i) => i.business.id)).toEqual(['far']);
    expect(store.filterCount()).toBe(1);

    store.clearFilters();
    store.query.set('near');
    expect(store.items().map((i) => i.business.id)).toEqual(['near']);
    expect(store.filtersActive()).toBe(true);
    expect(repo.getNearby).toHaveBeenCalledOnce();
  });

  it('reports an empty result only after a successful load', async () => {
    expect(store.empty()).toBe(false);
    repo.getNearby.mockResolvedValue({ data: [], errorKey: null });

    await store.load(1.21, -77.28);

    expect(store.empty()).toBe(true);
  });

  it('exposes the repository error key', async () => {
    repo.getNearby.mockResolvedValue({ data: null, errorKey: 'businesses.errors.loadFailed' });

    await store.load(1.21, -77.28);

    expect(store.errorKey()).toBe('businesses.errors.loadFailed');
    expect(store.empty()).toBe(false);
  });

  it('marks businesses without reviews and keeps their first promotion', async () => {
    await store.load(1.21, -77.28);
    const near = store.items().find((i) => i.business.id === 'near');

    expect(near?.rating).toBeNull();
    expect(near?.ratingsLoaded).toBe(true);
    expect(near?.promotion?.title).toBe('Café gratis');
  });

  it('treats ratings as unknown, not as "no reviews", when they fail', async () => {
    highlights.getRatings.mockResolvedValue({ data: null, errorKey: 'x' });

    await store.load(1.21, -77.28);

    expect(store.items().every((i) => i.rating === null && !i.ratingsLoaded)).toBe(true);
    expect(store.errorKey()).toBeNull();
  });
});
