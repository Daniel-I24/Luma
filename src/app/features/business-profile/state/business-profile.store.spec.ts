import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessHighlightsRepository } from '@shared/business/data/business-highlights.repository';
import { PromotionDealRepository } from '@shared/promotions/promotion-deal.repository';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { MenuRepository } from '@shared/business/data/menu.repository';
import type { Business } from '@shared/business/models/business.model';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { BusinessProfileStore } from './business-profile.store';

const ID = '2f9c1d8e-1111-4000-8000-000000000001';
const business = {
  id: ID,
  name: 'Café La Merced',
  latitude: 1.215,
  longitude: -77.2795,
} as Business;

describe('BusinessProfileStore', () => {
  const businesses = { getById: vi.fn(), getHours: vi.fn() };
  const highlights = { getRatings: vi.fn() };
  const deals = { listForBusiness: vi.fn() };
  const menu = { getMenu: vi.fn() };
  let store: BusinessProfileStore;

  beforeEach(() => {
    vi.clearAllMocks();
    businesses.getById.mockResolvedValue({ data: business, errorKey: null });
    businesses.getHours.mockResolvedValue({ data: [], errorKey: null });
    highlights.getRatings.mockResolvedValue({
      data: new Map([[ID, { businessId: ID, rating: 4.3, reviewCount: 7 }]]),
      errorKey: null,
    });
    deals.listForBusiness.mockResolvedValue({
      data: [{ deal: { id: 'p1' }, hours: [] }],
      errorKey: null,
    });
    menu.getMenu.mockResolvedValue({ data: [{ id: 'm1' }], errorKey: null });
    TestBed.configureTestingModule({
      providers: [
        BusinessProfileStore,
        { provide: BusinessRepository, useValue: businesses },
        { provide: BusinessHighlightsRepository, useValue: highlights },
        { provide: PromotionDealRepository, useValue: deals },
        { provide: MenuRepository, useValue: menu },
        {
          provide: GeolocationService,
          useValue: {
            coords: signal({ lat: 1.2136, lng: -77.2811 }),
            hasRealLocation: signal(true),
          },
        },
      ],
    });
    store = TestBed.inject(BusinessProfileStore);
  });

  it('loads the business and then its details in parallel', async () => {
    await store.load(ID);

    expect(store.state()).toBe('ready');
    expect(store.business()).toBe(business);
    expect(store.rating()?.reviewCount).toBe(7);
    expect(store.promotions()).toHaveLength(1);
    expect(store.menu()).toHaveLength(1);
    expect(highlights.getRatings).toHaveBeenCalledWith([ID]);
    expect(store.distanceKm()).toBeGreaterThan(0);
  });

  it('treats a malformed id as not found without calling the server', async () => {
    await store.load('not-a-uuid');

    expect(store.state()).toBe('notFound');
    expect(businesses.getById).not.toHaveBeenCalled();
  });

  it('reports a business that does not exist or is inactive as not found', async () => {
    businesses.getById.mockResolvedValue({ data: null, errorKey: null });

    await store.load(ID);

    expect(store.state()).toBe('notFound');
    expect(menu.getMenu).not.toHaveBeenCalled();
  });

  it('reports a server error', async () => {
    businesses.getById.mockResolvedValue({ data: null, errorKey: 'businesses.errors.loadFailed' });

    await store.load(ID);

    expect(store.state()).toBe('error');
  });

  it('keeps the profile when only the menu fails', async () => {
    menu.getMenu.mockResolvedValue({ data: null, errorKey: 'businesses.errors.menuFailed' });

    await store.load(ID);

    expect(store.state()).toBe('ready');
    expect(store.menu()).toBeNull();
  });
});
