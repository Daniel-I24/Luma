import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('APP_VERSION matches package.json', () => {
  const { version } = JSON.parse(read('package.json'));
  const constant = /APP_VERSION = '([^']+)'/.exec(read('src/app/core/config/app-version.ts'))?.[1];
  assert.equal(constant, version);
});
