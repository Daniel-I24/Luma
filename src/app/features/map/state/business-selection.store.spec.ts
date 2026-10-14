import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Business, Promotion } from '@shared/business/models/business.model';
import { BusinessHoursCacheService } from '../services/business-hours-cache.service';
import { MapMarkerSyncService } from '../services/map-marker-sync.service';
import { BusinessSelectionStore } from './business-selection.store';
import type { NearbyBusiness } from './nearby-businesses.store';

const promo = { id: 'p1', business_id: 'a', title: '2×1 en hamburguesas' } as Promotion;
const item = (id: string, promotion: Promotion | null = null): NearbyBusiness => ({
  business: { id, name: id } as Business,
  status: 'open',
  distanceKm: null,
  rating: null,
  ratingsLoaded: true,
  promotion,
  logoIcon: 'store',
});

describe('BusinessSelectionStore', () => {
  const markers = { select: vi.fn() };
  let store: BusinessSelectionStore;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        BusinessSelectionStore,
        { provide: BusinessHoursCacheService, useValue: { get: vi.fn(() => []) } },
        { provide: MapMarkerSyncService, useValue: markers },
      ],
    });
    store = TestBed.inject(BusinessSelectionStore);
  });

  it('opens the sheet, highlights the marker and exposes the promotion', () => {
    store.select(item('a', promo));

    expect(store.open()).toBe(true);
    expect(store.selectedId()).toBe('a');
    expect(markers.select).toHaveBeenCalledWith('a');
    expect(store.promotion()).toBe(promo);
  });

  it('switches to another business and its (missing) promotion', () => {
    store.select(item('a', promo));

    store.select(item('b'));

    expect(store.selectedId()).toBe('b');
    expect(store.promotion()).toBeNull();
  });

  it('closes the sheet and clears the highlighted marker', () => {
    store.select(item('a'));

    store.close();

    expect(store.open()).toBe(false);
    expect(markers.select).toHaveBeenLastCalledWith(null);
  });
});
