import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessRepository } from '@shared/business/data/business.repository';
import type { Business, Promotion } from '@shared/business/models/business.model';
import { BusinessHoursCacheService } from '../services/business-hours-cache.service';
import { MapMarkerSyncService } from '../services/map-marker-sync.service';
import { BusinessSelectionStore } from './business-selection.store';
import type { NearbyBusiness } from './nearby-businesses.store';

const item = (id: string): NearbyBusiness => ({
  business: { id, name: id } as Business,
  status: 'open',
  distanceKm: null,
  rating: null,
  logoIcon: 'store',
});

describe('BusinessSelectionStore', () => {
  const promo = { id: 'p1', title: '2×1 en hamburguesas' } as Promotion;
  const repo = { getActivePromotions: vi.fn() };
  const markers = { select: vi.fn() };
  let store: BusinessSelectionStore;

  beforeEach(() => {
    vi.clearAllMocks();
    repo.getActivePromotions.mockResolvedValue({ data: [promo], errorKey: null });
    TestBed.configureTestingModule({
      providers: [
        BusinessSelectionStore,
        { provide: BusinessRepository, useValue: repo },
        { provide: BusinessHoursCacheService, useValue: { get: vi.fn(() => []) } },
        { provide: MapMarkerSyncService, useValue: markers },
      ],
    });
    store = TestBed.inject(BusinessSelectionStore);
  });

  it('opens the sheet, highlights the marker and loads the promotion', async () => {
    await store.select(item('a'));

    expect(store.open()).toBe(true);
    expect(store.selectedId()).toBe('a');
    expect(markers.select).toHaveBeenCalledWith('a');
    expect(store.promotion()).toBe(promo);
  });

  it('ignores a late promotion of a business that is no longer selected', async () => {
    let resolveFirst!: (value: unknown) => void;
    repo.getActivePromotions.mockReturnValueOnce(new Promise((r) => (resolveFirst = r)));
    const first = store.select(item('a'));
    await store.select(item('b'));

    resolveFirst({ data: [{ id: 'old', title: 'Vieja' }], errorKey: null });
    await first;

    expect(store.promotion()).toBe(promo);
  });

  it('closes the sheet and clears the highlighted marker', async () => {
    await store.select(item('a'));

    store.close();

    expect(store.open()).toBe(false);
    expect(markers.select).toHaveBeenLastCalledWith(null);
  });
});
