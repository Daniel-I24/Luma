import { describe, expect, it } from 'vitest';
import { estimateReadyAt, estimateTravelMinutes } from './order-estimates.util';

describe('estimateTravelMinutes', () => {
  it('walks up to 1.5 km at about 4.8 km/h', () => {
    expect(estimateTravelMinutes(0.4)).toEqual({ mode: 'walk', minutes: 5, approximate: true });
    expect(estimateTravelMinutes(1.5)).toEqual({ mode: 'walk', minutes: 19, approximate: true });
    expect(estimateTravelMinutes(0)).toEqual({ mode: 'walk', minutes: 1, approximate: true });
  });

  it('drives beyond 1.5 km at about 20 km/h', () => {
    expect(estimateTravelMinutes(1.6)).toEqual({ mode: 'vehicle', minutes: 5, approximate: true });
    expect(estimateTravelMinutes(10)).toEqual({ mode: 'vehicle', minutes: 30, approximate: true });
  });
});

describe('estimateReadyAt', () => {
  const created = '2026-10-17T12:00:00.000Z';

  it('uses the requested pick-up time when there is one', () => {
    expect(
      estimateReadyAt({ pickup_at: '2026-10-17T18:00:00.000Z', created_at: created }, 35),
    ).toEqual({
      kind: 'pickup',
      at: '2026-10-17T18:00:00.000Z',
    });
  });

  it('adds the business preparation time to the order time', () => {
    expect(estimateReadyAt({ pickup_at: null, created_at: created }, 35)).toEqual({
      kind: 'ready',
      at: '2026-10-17T12:35:00.000Z',
    });
  });

  it('falls back to 20 minutes when the preparation time is unknown', () => {
    expect(estimateReadyAt({ pickup_at: null, created_at: created }, null).at).toBe(
      '2026-10-17T12:20:00.000Z',
    );
  });
});
