import assert from 'node:assert/strict';
import { test } from 'node:test';

import { QUIET, colorTokens, contrast, failures, parseColor, themes } from './brand-contrast.mjs';

test('contrast follows WCAG 2.1, translucent backgrounds blended over the surface', () => {
  assert.equal(contrast('#000000', '#ffffff').toFixed(1), '21.0');
  assert.equal(contrast('#ffffff', '#ffffff').toFixed(1), '1.0');
  assert.deepEqual(parseColor('rgb(46 125 50 / 0.12)'), [46, 125, 50, 0.12]);
  assert.ok(contrast('#1d5c21', 'rgb(46 125 50 / 0.12)', '#ffffff') > 4.5);
  assert.throws(() => parseColor('blue'));
});

test('tokens are read from the theme blocks', () => {
  assert.deepEqual(colorTokens('--color-fg: #15202b; --spacing-1: 4px;'), { fg: '#15202b' });
  assert.deepEqual(Object.keys(themes()).sort(), ['crema', 'default']);
});

test('every theme passes AA on every text and UI pair', () => {
  assert.deepEqual(failures(), []);
});

test('the food doodles stay quiet in every theme (a maximum, not a minimum)', () => {
  const all = themes();
  for (const [theme, tokens] of Object.entries(all)) {
    for (const [fg, bg, max] of QUIET) assert.ok(contrast(tokens[fg], tokens[bg], tokens.surface) <= max, `${theme} ${fg}`);
  }
  const loud = { ...all.default, 'doodle-line': '#0b4f9c' };
  assert.ok(failures({ loud }).some(([, fg]) => fg === 'doodle-line'));
});
