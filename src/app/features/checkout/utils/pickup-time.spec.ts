import { describe, expect, it } from 'vitest';
import { PickupTime } from './pickup-time';

const now = new Date('2026-10-17T14:00:00');

describe('resolvePickup', () => {
  it('sends no time for "Ahora" (as soon as possible)', () => {
    expect(PickupTime.resolvePickup('now', '', now)).toEqual({ pickupAt: null, errorKey: null });
  });

  it('schedules today for "Más tarde" when at least 10 minutes ahead', () => {
    expect(PickupTime.resolvePickup('later', '15:30', now)).toEqual({
      pickupAt: new Date('2026-10-17T15:30:00').toISOString(),
      errorKey: null,
    });
    expect(PickupTime.resolvePickup('later', '14:10', now).errorKey).toBeNull();
  });

  it('rejects times too soon or in the past', () => {
    expect(PickupTime.resolvePickup('later', '14:09', now).errorKey).toBe('checkout.errors.tooSoon');
    expect(PickupTime.resolvePickup('later', '09:00', now).errorKey).toBe('checkout.errors.tooSoon');
  });

  it('schedules tomorrow for "Mañana", even early in the morning', () => {
    expect(PickupTime.resolvePickup('tomorrow', '07:00', now).pickupAt).toBe(
      new Date('2026-10-18T07:00:00').toISOString(),
    );
  });

  it('asks for a valid time', () => {
    expect(PickupTime.resolvePickup('later', '', now).errorKey).toBe('checkout.errors.timeRequired');
    expect(PickupTime.resolvePickup('tomorrow', '25:00', now).errorKey).toBe('checkout.errors.timeRequired');
  });
});
