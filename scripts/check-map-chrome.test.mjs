import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FILTER_COUNTS, MAP_FONT_SCALES, MAP_THEMES, MAP_VIEWPORTS, chromeProblems } from './check-map-chrome.mjs';

const rect = (left, top, right, bottom) => ({ left, top, right, bottom });
const chip = (left, right) => rect(left, 110, right, 154);
const good = () => ({
  chips: [chip(120, 220), chip(228, 328)],
  scroller: rect(112, 110, 300, 154),
  filterButton: rect(16, 110, 104, 154),
  controls: [rect(160, 244, 204, 288), rect(212, 244, 256, 288), rect(264, 244, 308, 288)],
  viewportWidth: 320,
});

test('the sizes, filter counts, text and themes the map must hold', () => {
  assert.deepEqual(FILTER_COUNTS, [1, 3, 6]);
  assert.deepEqual(MAP_FONT_SCALES, [1, 2]);
  assert.deepEqual(MAP_THEMES, ['ciruela', 'crema']);
  assert.equal(MAP_VIEWPORTS[0][0], 320);
  assert.ok(MAP_VIEWPORTS.some(([w]) => w === 430));
  assert.ok(MAP_VIEWPORTS.some(([w]) => w >= 768));
});

test('a clean row has no problems', () => {
  assert.deepEqual(chromeProblems(good(), 2), []);
});

test('finds overlapping chips, a wrong gap and a missing chip', () => {
  const overlap = { ...good(), chips: [chip(120, 220), chip(200, 300)] };
  assert.match(chromeProblems(overlap, 2)[0], /gap -20/);
  assert.match(chromeProblems(good(), 3)[0], /2 chips, expected 3/);
});

test('finds a row outside the side margin', () => {
  assert.match(chromeProblems({ ...good(), filterButton: rect(-8, 110, 80, 154) }, 2)[0], /outside the margin/);
  assert.match(chromeProblems({ ...good(), scroller: rect(112, 110, 318, 154) }, 2)[0], /outside the margin/);
  assert.match(chromeProblems({ ...good(), scroller: rect(90, 110, 300, 154) }, 2)[0], /under the filters button/);
});

test('finds a map button over the filter row (what a 320 x 568 phone showed)', () => {
  const low = { ...good(), controls: [rect(264, 140, 308, 184)] };
  assert.match(chromeProblems(low, 2)[0], /map button touches/);
});
