import { afterEach, beforeEach, vi } from 'vitest';

/** A Wednesday at midday, local time: the default "now" of deterministic specs. */
export const FIXED_NOW = '2026-10-14T12:00:00';

/**
 * Pins `Date` (and only `Date`: timers stay real) for every test of the
 * calling suite, so results never depend on when the suite runs.
 */
export function useFixedClock(iso: string = FIXED_NOW): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
  });
  afterEach(() => vi.useRealTimers());
}
