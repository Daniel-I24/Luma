import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BusinessHoursCacheService } from './business-hours-cache.service';
import { BusinessRepository } from '@features/businesses/data/business.repository';
import type { BusinessHours } from '@features/businesses/models/business.model';

function makeHours(businessId: string): BusinessHours[] {
  return [{
    id: `${businessId}-1`,
    business_id: businessId,
    day_of_week: 1,
    opens_at: '09:00',
    closes_at: '20:00',
    is_closed: false,
  }];
}

describe('BusinessHoursCacheService', () => {
  let cache: BusinessHoursCacheService;
  let getHours: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getHours = vi.fn(async (id: string) => ({ data: makeHours(id), errorKey: null }));
    TestBed.configureTestingModule({
      providers: [
        BusinessHoursCacheService,
        { provide: BusinessRepository, useValue: { getHours } },
      ],
    });
    cache = TestBed.inject(BusinessHoursCacheService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('prefetches missing businesses in parallel via getHours', async () => {
    await cache.prefetch(['a', 'b']);
    expect(getHours).toHaveBeenCalledTimes(2);
    expect(getHours).toHaveBeenCalledWith('a');
    expect(getHours).toHaveBeenCalledWith('b');
    expect(cache.get('a')).toEqual(makeHours('a'));
    expect(cache.get('b')).toEqual(makeHours('b'));
  });

  it('does not refetch hours already in the cache', async () => {
    await cache.prefetch(['a']);
    await cache.prefetch(['a', 'b']);
    expect(getHours).toHaveBeenCalledTimes(2);
    expect(getHours.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
  });
});
