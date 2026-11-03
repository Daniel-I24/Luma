import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('APP_VERSION matches package.json', () => {
  const { version } = JSON.parse(read('package.json'));
  const constant = /APP_VERSION = '([^']+)'/.exec(read('src/app/core/config/app-version.ts'))?.[1];
  assert.equal(constant, version);
});

test('public/version.json announces this version and never requires a newer one', () => {
  const { version } = JSON.parse(read('package.json'));
  const file = JSON.parse(read('public/version.json'));
  assert.equal(file.latest, version);
  const parts = (v) => v.split('.').map(Number);
  const [a, b] = [parts(file.minimum), parts(version)];
  assert.ok(a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] <= b[2]))));
});
