import { describe, expect, it } from 'vitest';
import { resolvePickup, suggestedLaterTime } from './pickup-time.util';

const now = new Date('2026-10-17T14:00:00');

describe('resolvePickup', () => {
  it('sends no time for "Ahora" (as soon as possible)', () => {
    expect(resolvePickup('now', '', now)).toEqual({ pickupAt: null, errorKey: null });
  });

  it('schedules today for "Más tarde" when at least 10 minutes ahead', () => {
    expect(resolvePickup('later', '15:30', now)).toEqual({
      pickupAt: new Date('2026-10-17T15:30:00').toISOString(),
      errorKey: null,
    });
    expect(resolvePickup('later', '14:10', now).errorKey).toBeNull();
  });

  it('rejects times too soon or in the past', () => {
    expect(resolvePickup('later', '14:09', now).errorKey).toBe('checkout.errors.tooSoon');
    expect(resolvePickup('later', '09:00', now).errorKey).toBe('checkout.errors.tooSoon');
  });

  it('schedules tomorrow for "Mañana", even early in the morning', () => {
    expect(resolvePickup('tomorrow', '07:00', now).pickupAt).toBe(
      new Date('2026-10-18T07:00:00').toISOString(),
    );
  });

  it('asks for a valid time', () => {
    expect(resolvePickup('later', '', now).errorKey).toBe('checkout.errors.timeRequired');
    expect(resolvePickup('tomorrow', '25:00', now).errorKey).toBe('checkout.errors.timeRequired');
  });
});

describe('suggestedLaterTime', () => {
  it('suggests half an hour ahead rounded up to 5 minutes', () => {
    expect(suggestedLaterTime(new Date('2026-10-17T14:02:00'))).toBe('14:35');
    expect(suggestedLaterTime(new Date('2026-10-17T23:50:00'))).toBe('00:20');
  });
});
