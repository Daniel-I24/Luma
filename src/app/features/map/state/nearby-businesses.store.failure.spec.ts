import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ErrorLog } from '@core/errors/error-log';
import { BusinessHighlightsRepository } from '@shared/business/data/business-highlights.repository';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { BusinessHoursCacheService } from '../services/business-hours-cache.service';
import { NearbyBusinessesStore } from './nearby-businesses.store';

describe('NearbyBusinessesStore failures', () => {
  it('a failure while reading the extras shows the service error instead of rejecting', async () => {
    TestBed.configureTestingModule({
      providers: [
        NearbyBusinessesStore,
        { provide: BusinessRepository, useValue: { getNearby: vi.fn().mockResolvedValue({ data: [], errorKey: null }) } },
        {
          provide: BusinessHighlightsRepository,
          useValue: {
            getRatings: vi.fn().mockRejectedValue(new Error('boom')),
            getActivePromotions: vi.fn().mockResolvedValue({ data: [], errorKey: null }),
          },
        },
        { provide: BusinessHoursCacheService, useValue: { prefetch: vi.fn().mockResolvedValue(undefined), get: vi.fn(), forget: vi.fn() } },
        { provide: GeolocationService, useValue: { coords: signal({ lat: 1.2, lng: -77.3 }), hasRealLocation: signal(false) } },
      ],
    });
    const store = TestBed.inject(NearbyBusinessesStore);

    await expect(store.load(1.21, -77.28)).resolves.toBeUndefined();

    expect(store.errorKey()).toBe('businesses.errors.service');
    expect(store.loading()).toBe(false);
    expect(TestBed.inject(ErrorLog).entries()[0]).toMatchObject({ source: 'map', message: 'boom' });
  });
});
