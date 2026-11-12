import { readFileSync } from 'node:fs';

/**
 * The first-visit guide of each section (TourId in tour-registry.ts). The flows start with every
 * guide already seen, so no guide appears 700 ms after a screen and covers what a test taps;
 * guides.e2e.mjs checks the guides themselves. Read from the source, so a new guide needs no edit here.
 */
const REGISTRY = new URL('../../src/app/shared/tutorial/tour-registry.ts', import.meta.url);

export const TOUR_IDS = (() => {
  const union = /export type TourId =([^;]+);/.exec(readFileSync(REGISTRY, 'utf8'))?.[1] ?? '';
  const ids = [...union.matchAll(/'([a-z-]+)'/g)].map((match) => match[1]);
  if (ids.length === 0) throw new Error('e2e: TourId not found in tour-registry.ts');
  return ids;
})();

/** The localStorage keys of DeviceStorage ("luma." + "tour.<user>.<guide>") that mark every guide as seen. */
export const seenGuideKeys = (userIds) => userIds.flatMap((user) => TOUR_IDS.map((tour) => `luma.tour.${user}.${tour}`));
