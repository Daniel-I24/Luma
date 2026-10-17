import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessRepository } from '@shared/business/data/business.repository';
import type { BusinessHours } from '@shared/business/models/business.model';
import { CartStore } from '@shared/cart/cart.store';
import { PickupScheduleStore } from './pickup-schedule.store';
import { useFixedClock } from '../../../../testing/fixed-clock';

// The fixed clock is Wednesday (3) 2026-10-14 at 12:00.
const day = (d: number, opens: string, closes: string, closed = false) =>
  ({
    day_of_week: d,
    opens_at: `${opens}:00`,
    closes_at: `${closes}:00`,
    is_closed: closed,
  }) as BusinessHours;

describe('PickupScheduleStore', () => {
  useFixedClock();

  const businesses = { getHours: vi.fn() };

  async function setup(hours: BusinessHours[] | null): Promise<PickupScheduleStore> {
    businesses.getHours.mockResolvedValue(
      hours ? { data: hours, errorKey: null } : { data: null, errorKey: 'x' },
    );
    TestBed.configureTestingModule({
      providers: [PickupScheduleStore, { provide: BusinessRepository, useValue: businesses }],
    });
    localStorage.clear();
    TestBed.inject(CartStore).add({
      menuItemId: 'm1',
      businessId: 'b1',
      businessName: 'Café',
      name: 'Pan',
      priceCop: 1000,
    });
    const store = TestBed.inject(PickupScheduleStore);
    TestBed.tick();
    await Promise.resolve();
    return store;
  }

  beforeEach(() => vi.clearAllMocks());

  it('allows "Ahora" while the business is open', async () => {
    const store = await setup([day(3, '08:00', '20:00')]);

    expect(businesses.getHours).toHaveBeenCalledWith('b1');
    expect(store.openNow()).toBe(true);
    expect(store.option()).toBe('now');
    expect(store.choice()).toEqual({ pickupAt: null, errorKey: null });
  });

  it('moves to "Más tarde" when closed and rejects "Ahora"', async () => {
    const store = await setup([day(3, '17:00', '20:00')]);

    expect(store.openNow()).toBe(false);
    expect(store.option()).toBe('later');
    store.option.set('now');
    expect(store.choice().errorKey).toBe('checkout.errors.closedNow');
  });

  it('offers only times inside today hours, defaulting to the first one', async () => {
    const store = await setup([day(3, '17:00', '18:00')]);

    expect(store.slots()).toEqual(['17:00', '17:15', '17:30', '17:45']);
    expect(store.time()).toBe('17:00');
    expect(store.ranges()).toBe('17:00–17:45');
    store.time.set('17:30');
    expect(store.choice().pickupAt).toBe(new Date('2026-10-14T17:30:00').toISOString());
    store.time.set('19:00');
    expect(store.choice().errorKey).toBe('checkout.errors.outsideHours');
  });

  it('handles hours that cross midnight on both days', async () => {
    const store = await setup([day(3, '22:00', '01:00'), day(4, '09:00', '09:30')]);
    store.option.set('later');
    expect(store.slots()).toEqual([
      '22:00',
      '22:15',
      '22:30',
      '22:45',
      '23:00',
      '23:15',
      '23:30',
      '23:45',
    ]);

    store.option.set('tomorrow');
    expect(store.ranges()).toBe('00:00–00:45, 09:00–09:15');
    store.time.set('00:30');
    expect(store.choice().pickupAt).toBe(new Date('2026-10-15T00:30:00').toISOString());
  });

  it('keeps the selected time while it is still offered', async () => {
    const store = await setup([day(3, '08:00', '20:00'), day(4, '08:00', '20:00')]);
    store.option.set('later');
    store.time.set('15:00');
    store.option.set('tomorrow');

    expect(store.time()).toBe('15:00');
  });

  it('offers nothing on a closed day and reports load errors', async () => {
    const closed = await setup([day(3, '08:00', '09:00'), day(4, '08:00', '20:00', true)]);
    closed.option.set('tomorrow');
    expect(closed.slots()).toEqual([]);
    expect(closed.time()).toBe('');
    TestBed.resetTestingModule();

    const failed = await setup(null);
    expect(failed.state()).toBe('error');
    expect(failed.openNow()).toBeNull();
  });
});
