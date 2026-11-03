import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { RouteRepository } from './route.repository';

const FROM = { lat: 1.2136, lng: -77.2811 };
const TO = { lat: 1.215, lng: -77.2795 };

describe('RouteRepository', () => {
  const invoke = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: { client: { functions: { invoke } } } }] });
  });

  it('returns the route of the function (fetch simulated by the client)', async () => {
    const road = { line: [[-77.2811, 1.2136], [-77.28, 1.214], [-77.2795, 1.215]], distanceM: 320, durationS: 240, source: 'openrouteservice' };
    invoke.mockResolvedValue({ data: road, error: null });

    expect(await TestBed.inject(RouteRepository).route(FROM, TO, 'walk')).toEqual(road);
    expect(invoke).toHaveBeenCalledWith('route', { method: 'POST', body: { from: FROM, to: TO, mode: 'walk' } });
  });

  it('without an answer (error, offline, odd shape) estimates a straight line with distance and time', async () => {
    const repo = TestBed.inject(RouteRepository);
    for (const answer of [Promise.resolve({ data: null, error: new Error('404') }), Promise.reject(new Error('offline')), Promise.resolve({ data: { line: [] }, error: null })]) {
      invoke.mockReturnValueOnce(answer);
      const route = await repo.route(FROM, TO, 'drive');
      expect(route.source).toBe('straight');
      expect(route.line).toEqual([[FROM.lng, FROM.lat], [TO.lng, TO.lat]]);
      expect(route.distanceM).toBeGreaterThan(200);
      expect(route.durationS).toBe(Math.round(route.distanceM / (25 / 3.6)));
    }
  });
});
