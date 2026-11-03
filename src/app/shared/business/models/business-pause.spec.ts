import { describe, expect, it } from 'vitest';
import { BusinessPause } from './business-pause';

const NOW = Date.parse('2026-11-01T12:00:00Z');

describe('BusinessPause', () => {
  it("treats 'infinity' (as PostgREST sends it) as paused until resumed", () => {
    for (const value of ['infinity', '+infinity', 'Infinity', ' infinity ']) {
      expect(BusinessPause.isPaused(value, NOW)).toBe(true);
      expect(BusinessPause.isIndefinite(value)).toBe(true);
    }
  });

  it('a timed pause lasts until its end, and nothing or garbage is not a pause', () => {
    expect(BusinessPause.isPaused('2026-11-01T12:30:00+00:00', NOW)).toBe(true);
    expect(BusinessPause.isIndefinite('2026-11-01T12:30:00+00:00')).toBe(false);
    expect(BusinessPause.isPaused('2026-11-01T11:59:00+00:00', NOW)).toBe(false);
    expect(BusinessPause.isPaused(null, NOW)).toBe(false);
    expect(BusinessPause.isPaused('-infinity', NOW)).toBe(false);
    expect(BusinessPause.isPaused('not a date', NOW)).toBe(false);
  });
});
