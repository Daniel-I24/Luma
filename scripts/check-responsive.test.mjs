import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FONT_SCALES, MIN_TARGET, VIEWPORTS } from './check-responsive.mjs';
import { SCREENS } from './screens/fixtures.mjs';

test('the sizes of the prompt: small and big phones, tablet, landscape and desktop, with 200 % text', () => {
  assert.deepEqual(VIEWPORTS.map(([w, h]) => `${w}x${h}`), ['320x568', '360x640', '390x844', '412x915', '600x960', '768x1024', '1024x768', '1280x800']);
  assert.deepEqual(FONT_SCALES, [1, 2]);
  assert.equal(MIN_TARGET, 44);
});

test('the main routes: customer, signed out and Luma Negocios with long names', () => {
  const names = SCREENS.map((s) => s.name);
  for (const name of ['login', 'map', 'feed', 'business', 'cart', 'profile', 'owner-summary', 'owner-menu', 'owner-verification']) assert.ok(names.includes(name), name);
  assert.ok(SCREENS.filter((s) => s.owner).every((s) => s.path.startsWith('/owner/')));
});
