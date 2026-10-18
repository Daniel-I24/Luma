import { describe, expect, it } from 'vitest';
import shared from '../../../../../supabase/tests/fixtures/opening_hours_cases.json';
import type { BusinessHours, BusinessStatus } from '../models/business.model';
import { getBusinessStatus, isOpenStatus } from '../utils/business-status.util';
import { OpeningHours } from './opening-hours';

interface SharedCase {
  name: string;
  hours: { day: number; opens: string; closes: string; closed?: boolean }[];
  at: { day: number; time: string };
  open: boolean;
  status: BusinessStatus;
}

const rows = (c: SharedCase) =>
  c.hours.map(
    (h) =>
      ({
        id: `h${h.day}`,
        business_id: 'b1',
        day_of_week: h.day,
        opens_at: `${h.opens}:00`,
        closes_at: `${h.closes}:00`,
        is_closed: h.closed ?? false,
      }) as BusinessHours,
  );

/** Local wall-clock moment: 2026-10-11 is a Sunday (day 0). */
function at(day: number, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  return new Date(2026, 9, 11 + day, h, m);
}

describe('OpeningHours (cases shared with the SQL business_open_at)', () => {
  for (const c of shared.cases as SharedCase[]) {
    it(c.name, () => {
      const hours = OpeningHours.from(rows(c));
      const moment = at(c.at.day, c.at.time);
      expect(hours.isOpenAt(moment)).toBe(c.open);
      expect(getBusinessStatus(rows(c), moment)).toBe(c.status);
      expect(isOpenStatus(hours.statusAt(moment))).toBe(c.open);
    });
  }
});

describe('OpeningHours windows', () => {
  const row = (day: BusinessHours['day_of_week'], opens: string, closes: string) =>
    ({ day_of_week: day, opens_at: opens, closes_at: closes, is_closed: false }) as BusinessHours;

  it('cuts a crossing row at midnight and carries its tail to the next day only', () => {
    const hours = OpeningHours.from([row(1, '18:00', '02:00')]);
    expect(hours.windowsFor(1)).toEqual([{ from: 1080, to: 1440 }]);
    expect(hours.windowsFor(2)).toEqual([{ from: 0, to: 120 }]);
  });

  it('ignores rows that open and close at the same time (invalid)', () => {
    expect(OpeningHours.from([row(1, '09:00', '09:00')]).windowsFor(1)).toEqual([]);
  });

  it('honours a custom soon window', () => {
    const hours = [row(1, '08:00', '18:00')];
    expect(getBusinessStatus(hours, at(1, '17:00'), 90)).toBe('closing-soon');
    expect(getBusinessStatus(hours, at(1, '17:00'), 30)).toBe('open');
  });
});
