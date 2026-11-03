import type { DayHoursInput } from '@shared/business/data/business-write.schemas';
import type { BusinessHours } from '@shared/business/models/business.model';
import { ClockTime } from '@shared/business/domain/opening-hours';

/** "HH:MM" out of "HH:MM:SS". */
const HH_MM = 5;

/** Days in the order the editor shows them (Monday first; 0 = Sunday). */
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- data table: Monday-first week
const WEEK_FROM_MONDAY = [1, 2, 3, 4, 5, 6, 0] as const;
const DEFAULT_OPENS = '08:00';
const DEFAULT_CLOSES = '18:00';

/** One editable day; times as "HH:MM". */
export type DayDraft = DayHoursInput;

/** WeekDrafts — the editable week of opening hours. */
export class WeekDrafts {
  /** The 7 days to edit, Monday first; days without a row start closed. */
  public static weekDraft(rows: readonly BusinessHours[]): DayDraft[] {
    return WEEK_FROM_MONDAY.map((day) => {
      const row = rows.find((r) => r.day_of_week === day);
      return {
        day_of_week: day,
        is_closed: row ? row.is_closed : true,
        opens_at: row ? row.opens_at.slice(0, HH_MM) : DEFAULT_OPENS,
        closes_at: row ? row.closes_at.slice(0, HH_MM) : DEFAULT_CLOSES,
      };
    });
  }

  /** An open day whose closing time is earlier than its opening time. */
  public static crossesMidnight(day: DayDraft): boolean {
    return !day.is_closed && ClockTime.timeToMinutes(day.closes_at) < ClockTime.timeToMinutes(day.opens_at);
  }
}

