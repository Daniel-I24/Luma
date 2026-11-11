import type { SelectOption } from '@design-system';

const MINUTES_PER_DAY = 24 * 60;
const STEP_MINUTES = 15;
const PAD = 2;

/** "HH:MM" of a minute of the day. */
const clock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(PAD, '0')}:${String(minutes % 60).padStart(PAD, '0')}`;

/** TimeOptions — the times an owner picks for opening and closing (no system clock dialog). */
export class TimeOptions {
  /** Every quarter of an hour, plus the saved time when it falls between them, in order. */
  public static quarterHours(current: string | null = null): SelectOption[] {
    const times = Array.from({ length: MINUTES_PER_DAY / STEP_MINUTES }, (_, i) => clock(i * STEP_MINUTES));
    if (current && /^\d{2}:\d{2}$/.test(current) && !times.includes(current)) times.push(current);
    return times.sort().map((time) => ({ value: time, label: time }));
  }
}
