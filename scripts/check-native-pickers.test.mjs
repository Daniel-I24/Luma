import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findNativePickers, scan } from './check-native-pickers.mjs';

const tags = (text) => findNativePickers(text).map((f) => f.tag);

test('finds native selects and system clock or calendar inputs', () => {
  assert.deepEqual(tags('<select id="x">\n<option>a</option></select>'), ['<select ']);
  assert.deepEqual(tags('<input\n  type="time"\n  [value]="t" />'), ['<input type="time"']);
  assert.deepEqual(tags('<app-luma-input type="date" />'), ['<app-luma-input type="date"']);
  assert.deepEqual(findNativePickers('a\n<select>').map((f) => f.line), [2]);
});

test('the app components, other inputs and comments do not count', () => {
  assert.deepEqual(tags('<app-luma-select [options]="o" />'), []);
  assert.deepEqual(tags('<input type="text" /><input type="checkbox" />'), []);
  assert.deepEqual(tags('<!-- <select> was here -->\n/** never a <select> */\n// <input type="time">'), []);
});

test('the app has no native picker', () => {
  assert.deepEqual(scan(), []);
});
