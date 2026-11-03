import { assertEquals, assertNotEquals } from '@std/assert';

import type { Candidate, RecommendInput } from './model.ts';
import { cacheMaterial } from './prompt.ts';

const input: RecommendInput = {
  moment: 'lunch',
  lat: 1.2136,
  lng: -77.2811,
  radiusKm: 5,
  at: '2026-10-19T12:05:00Z',
};
const candidates: Candidate[] = [];

Deno.test('the cache key changes with the area (about 1 km) and the 20-minute window', () => {
  const key = cacheMaterial(input, candidates);
  assertEquals(cacheMaterial({ ...input, lat: 1.2139 }, candidates), key);
  assertNotEquals(cacheMaterial({ ...input, lat: 1.2236 }, candidates), key);
  assertNotEquals(cacheMaterial({ ...input, lng: -77.2911 }, candidates), key);
  assertNotEquals(cacheMaterial({ ...input, at: '2026-10-19T12:25:00Z' }, candidates), key);
});
