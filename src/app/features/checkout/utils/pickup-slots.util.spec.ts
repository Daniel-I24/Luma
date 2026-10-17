import { describe, expect, it } from 'vitest';
import type { BusinessHours } from '@shared/business/models/business.model';
import { pickupSlots, slotRanges, windowsForDay } from './pickup-slots.util';

const entry = (day: BusinessHours['day_of_week'], opens: string, closes: string, closed = false): BusinessHours => ({
  id: `h${day}`,
  business_id: 'b1',
  day_of_week: day,
  opens_at: `${opens}:00`,
  closes_at: `${closes}:00`,
  is_closed: closed,
});

// 2026-10-17 is a Saturday (6); 2026-10-18 a Sunday (0).
const SATURDAY_NOON = new Date('2026-10-17T12:00:00');

describe('windowsForDay', () => {
  it('uses the day hours, or nothing when closed or missing', () => {
    expect(windowsForDay([entry(6, '08:00', '19:00')], 6)).toEqual([{ from: 480, to: 1140 }]);
    expect(windowsForDay([entry(6, '08:00', '19:00', true)], 6)).toEqual([]);
    expect(windowsForDay([], 6)).toEqual([]);
  });

  it('cuts a midnight-crossing schedule at midnight and carries its tail to the next day', () => {
    const hours = [entry(6, '18:00', '02:00')];
    expect(windowsForDay(hours, 6)).toEqual([{ from: 1080, to: 1440 }]);
    expect(windowsForDay(hours, 0)).toEqual([{ from: 0, to: 120 }]);
  });

  it('keeps the tail even when the next day is closed, and adds the next day hours', () => {
    expect(windowsForDay([entry(6, '18:00', '02:00'), entry(0, '09:00', '12:00', true)], 0)).toEqual([
      { from: 0, to: 120 },
    ]);
    expect(windowsForDay([entry(6, '18:00', '02:00'), entry(0, '09:00', '12:00')], 0)).toEqual([
      { from: 0, to: 120 },
      { from: 540, to: 720 },
    ]);
  });

  it('treats closing at midnight as no tail', () => {
    expect(windowsForDay([entry(6, '18:00', '00:00')], 0)).toEqual([]);
  });
});

describe('pickupSlots', () => {
  it('offers 15-minute slots from 10 minutes ahead until before closing', () => {
    const slots = pickupSlots([entry(6, '08:00', '13:00')], SATURDAY_NOON, SATURDAY_NOON);
    expect(slots).toEqual(['12:15', '12:30', '12:45']);
  });

  it('offers nothing today once the business closed', () => {
    expect(pickupSlots([entry(6, '08:00', '11:00')], SATURDAY_NOON, SATURDAY_NOON)).toEqual([]);
  });

  it('offers tomorrow the after-midnight tail and the day hours', () => {
    const hours = [entry(6, '22:00', '01:00'), entry(0, '10:00', '11:00')];
    const tomorrow = new Date('2026-10-18T00:00:00');
    expect(pickupSlots(hours, tomorrow, SATURDAY_NOON)).toEqual([
      '00:00', '00:15', '00:30', '00:45', '10:00', '10:15', '10:30', '10:45',
    ]);
  });

  it('applies the 10-minute lead across midnight', () => {
    const hours = [entry(6, '22:00', '01:00')];
    const lateNight = new Date('2026-10-17T23:55:00');
    expect(pickupSlots(hours, new Date('2026-10-18T00:00:00'), lateNight)[0]).toBe('00:15');
  });
});

describe('slotRanges', () => {
  it('groups consecutive slots', () => {
    expect(slotRanges(['00:00', '00:15', '10:00', '10:15', '10:30', '18:00'])).toEqual([
      '00:00–00:15',
      '10:00–10:30',
      '18:00',
    ]);
    expect(slotRanges([])).toEqual([]);
  });
});
