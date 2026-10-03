import { describe, it, expect } from 'vitest';
import { getBusinessStatus } from './business-status.util';
import type { BusinessHours } from '../models/business.model';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Builds a minimal BusinessHours entry for a given weekday. */
function makeHours(
  day: BusinessHours['day_of_week'],
  opens: string,
  closes: string,
  is_closed = false,
): BusinessHours {
  return {
    id: `test-${day}`,
    business_id: 'biz-1',
    day_of_week: day,
    opens_at: opens,
    closes_at: closes,
    is_closed,
  };
}

/**
 * Creates a Date anchored to a known week.
 * Base: Sunday 7 Jan 2024 → day 0.
 * day=1 → Monday 8 Jan 2024, day=2 → Tuesday 9 Jan 2024, etc.
 */
function makeDate(day: number, hh: number, mm: number): Date {
  const d = new Date(2024, 0, 7 + day);
  d.setHours(hh, mm, 0, 0);
  return d;
}

// Monday 09:00–20:00 (normal schedule used across multiple tests)
const mondayHours = makeHours(1, '09:00', '20:00');
const allWeekHours: BusinessHours[] = [0, 1, 2, 3, 4, 5, 6].map((d) =>
  makeHours(d as BusinessHours['day_of_week'], '09:00', '20:00'),
);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getBusinessStatus', () => {

  // ── 1. Open ──────────────────────────────────────────────────────────────
  it('returns "open" when current time is well within opening hours', () => {
    const now = makeDate(1, 12, 0); // Monday 12:00
    expect(getBusinessStatus([mondayHours], now)).toBe('open');
  });

  // ── 2. Closed ────────────────────────────────────────────────────────────
  it('returns "closed" when current time is before opening hours', () => {
    const now = makeDate(1, 7, 0); // Monday 07:00 (before 09:00)
    expect(getBusinessStatus([mondayHours], now)).toBe('closed');
  });

  it('returns "closed" when the day entry has is_closed = true', () => {
    const closedMonday = makeHours(1, '09:00', '20:00', true);
    const now = makeDate(1, 12, 0);
    expect(getBusinessStatus([closedMonday], now)).toBe('closed');
  });

  // ── 3. Opening soon ───────────────────────────────────────────────────────
  it('returns "opening-soon" within the default 30-min window before opening', () => {
    const now = makeDate(1, 8, 45); // Monday 08:45 (15 min before 09:00)
    expect(getBusinessStatus([mondayHours], now)).toBe('opening-soon');
  });

  it('returns "closed" when 31+ minutes before opening', () => {
    const now = makeDate(1, 8, 28); // Monday 08:28 (32 min before 09:00)
    expect(getBusinessStatus([mondayHours], now)).toBe('closed');
  });

  // ── 4. Closing soon ───────────────────────────────────────────────────────
  it('returns "closing-soon" within the default 30-min window before closing', () => {
    const now = makeDate(1, 19, 45); // Monday 19:45 (15 min before 20:00)
    expect(getBusinessStatus([mondayHours], now)).toBe('closing-soon');
  });

  // ── 5. Midnight-crossing — evening side (same calendar day as entry) ──────
  it('returns "open" during the evening of a midnight-crossing schedule', () => {
    // Monday entry: 18:00 – 02:00. Evaluated Monday at 22:00 (same day as entry).
    const mondayNight = makeHours(1, '18:00', '02:00');
    const now = makeDate(1, 22, 0); // Monday 22:00
    expect(getBusinessStatus([mondayNight], now)).toBe('open');
  });

  // ── 6. Midnight-crossing — after-midnight side (DIFFERENT calendar day) ───
  it('returns "open" after midnight using YESTERDAY\'s entry (real cross-day case)', () => {
    // Entry lives on MONDAY (day=1): opens 18:00, closes 02:00 Tuesday.
    // Evaluated on TUESDAY (day=2) at 01:00 AM → must use Monday's entry.
    const mondayNight = makeHours(1, '18:00', '02:00');
    const tuesdayNow = makeDate(2, 1, 0); // Tuesday 01:00
    expect(getBusinessStatus([mondayNight], tuesdayNow)).toBe('open');
  });

  it('returns "open" after midnight even when Tuesday entry is marked is_closed', () => {
    // Monday entry crosses midnight; Tuesday is explicitly closed.
    // Business should still be "open" at Tuesday 01:00 from Monday's schedule.
    const mondayNight = makeHours(1, '18:00', '02:00');
    const tuesdayClosed = makeHours(2, '09:00', '20:00', true);
    const tuesdayNow = makeDate(2, 1, 0); // Tuesday 01:00
    expect(getBusinessStatus([mondayNight, tuesdayClosed], tuesdayNow)).toBe('open');
  });

  // ── 7. Midnight-crossing — gap (between closes and opens, same entry day) ─
  it('returns "closed" in the gap of a midnight-crossing schedule', () => {
    // Monday entry 18:00–02:00. Monday at 10:00 is in the gap (after 02:00, before 18:00).
    const mondayNight = makeHours(1, '18:00', '02:00');
    const now = makeDate(1, 10, 0); // Monday 10:00
    expect(getBusinessStatus([mondayNight], now)).toBe('closed');
  });

  // ── 8. Closing soon — after-midnight side, DIFFERENT calendar day ─────────
  it('returns "closing-soon" near the after-midnight close using YESTERDAY\'s entry', () => {
    // Entry on MONDAY (day=1): opens 18:00, closes 02:00.
    // Evaluated on TUESDAY (day=2) at 01:45 → 15 min before 02:00.
    const mondayNight = makeHours(1, '18:00', '02:00');
    const tuesdayNow = makeDate(2, 1, 45); // Tuesday 01:45
    expect(getBusinessStatus([mondayNight], tuesdayNow)).toBe('closing-soon');
  });

  // ── 9. Custom soon window ─────────────────────────────────────────────────
  it('respects a custom soonWindowMinutes parameter', () => {
    const now = makeDate(1, 8, 55); // Monday 08:55 (5 min before 09:00)
    expect(getBusinessStatus([mondayHours], now, 10)).toBe('opening-soon');
    expect(getBusinessStatus([mondayHours], now, 3)).toBe('closed');
  });

  // ── 10. Full week coverage ────────────────────────────────────────────────
  it('returns "open" on a Sunday when all days have the same schedule', () => {
    const now = makeDate(0, 14, 0); // Sunday 14:00
    expect(getBusinessStatus(allWeekHours, now)).toBe('open');
  });

  // ── 11. Priority: today open wins over yesterday's midnight carry-over ────
  it('gives priority to today\'s open status over yesterday\'s midnight carry-over', () => {
    // Yesterday (Monday, day=1): midnight schedule 20:00–03:00.
    // Today (Tuesday, day=2): normal schedule 00:30–22:00.
    // Evaluated Tuesday at 01:00 → both could claim "open"; today wins.
    const mondayLate = makeHours(1, '20:00', '03:00');
    const tuesdayEarly = makeHours(2, '00:30', '22:00');
    const now = makeDate(2, 1, 0); // Tuesday 01:00
    // Both are open; today's entry (tuesday) takes priority — result is still 'open'.
    expect(getBusinessStatus([mondayLate, tuesdayEarly], now)).toBe('open');
  });
});
