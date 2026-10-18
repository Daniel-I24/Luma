import type { BusinessHours, BusinessStatus } from '../models/business.model';

const DAY_MINUTES = 24 * 60;
/** Minutes before opening / closing that trigger the "soon" statuses. */
export const SOON_WINDOW_MINUTES = 30;

/** An opening interval of one calendar day, in minutes; `to` is exclusive. */
export interface DayWindow {
  readonly from: number;
  readonly to: number;
}

type HoursRow = Pick<BusinessHours, 'day_of_week' | 'opens_at' | 'closes_at' | 'is_closed'>;

/** 'HH:MM' or 'HH:MM:SS' → minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * OpeningHours — the single opening-hours rule of the app (the database
 * mirrors it in public.business_open_at):
 * - a row of day D is open on D from opens_at until closes_at;
 * - when closes_at < opens_at it crosses midnight and ends at closes_at of
 *   D+1; only that crossing makes D+1's early morning open;
 * - today's row never opens today's early morning;
 * - a closed day neither opens nor carries an early morning to the next day;
 * - opens_at = closes_at is invalid and ignored (the database rejects it).
 * Times are the local wall clock of the given Date.
 */
export class OpeningHours {
  private constructor(private readonly rows: readonly HoursRow[]) {}

  static from(rows: readonly HoursRow[]): OpeningHours {
    return new OpeningHours(
      rows.filter(
        (row) => !row.is_closed && timeToMinutes(row.opens_at) !== timeToMinutes(row.closes_at),
      ),
    );
  }

  /** Windows that fall on a calendar day, in time order. */
  windowsFor(day: number): DayWindow[] {
    const windows: DayWindow[] = [];
    const previous = this.row((day + 6) % 7);
    if (previous && this.crosses(previous) && timeToMinutes(previous.closes_at) > 0) {
      windows.push({ from: 0, to: timeToMinutes(previous.closes_at) });
    }
    const own = this.row(day);
    if (own) {
      const opens = timeToMinutes(own.opens_at);
      windows.push({
        from: opens,
        to: this.crosses(own) ? DAY_MINUTES : timeToMinutes(own.closes_at),
      });
    }
    return windows;
  }

  isOpenAt(at: Date): boolean {
    return this.minutesUntilClose(at) !== null;
  }

  /** open, closing-soon, opening-soon or closed, from the same rule. */
  statusAt(at: Date, soonMinutes = SOON_WINDOW_MINUTES): BusinessStatus {
    const untilClose = this.minutesUntilClose(at);
    if (untilClose !== null) return untilClose <= soonMinutes ? 'closing-soon' : 'open';
    const untilOpen = this.minutesUntilOpen(at);
    return untilOpen !== null && untilOpen <= soonMinutes ? 'opening-soon' : 'closed';
  }

  /** Minutes until the window containing `at` ends (following a midnight crossing), or null. */
  private minutesUntilClose(at: Date): number | null {
    const day = at.getDay();
    const now = at.getHours() * 60 + at.getMinutes();
    const window = this.windowsFor(day).find((w) => now >= w.from && now < w.to);
    if (!window) return null;
    const own = this.row(day);
    const continues = window.to === DAY_MINUTES && own !== undefined && this.crosses(own);
    return window.to - now + (continues ? timeToMinutes(own.closes_at) : 0);
  }

  /** Minutes until the next opening today or tomorrow, or null. */
  private minutesUntilOpen(at: Date): number | null {
    const day = at.getDay();
    const now = at.getHours() * 60 + at.getMinutes();
    const today = this.windowsFor(day).find((w) => w.from > now);
    if (today) return today.from - now;
    const tomorrow = this.windowsFor((day + 1) % 7)[0];
    return tomorrow ? DAY_MINUTES - now + tomorrow.from : null;
  }

  private row(day: number): HoursRow | undefined {
    return this.rows.find((row) => row.day_of_week === day);
  }

  private crosses(row: HoursRow): boolean {
    return timeToMinutes(row.closes_at) < timeToMinutes(row.opens_at);
  }
}
