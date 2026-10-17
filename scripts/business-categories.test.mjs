import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the app category list matches the database CHECK constraint', () => {
  const app = [
    ...read('src/app/shared/business/data/business-categories.ts').matchAll(/value: '([^']+)'/g),
  ].map((m) => m[1]);
  const migration = readdirSync(new URL('../supabase/migrations', import.meta.url))
    .map((file) => read(`supabase/migrations/${file}`))
    .find((sql) => sql.includes('businesses_category_valid'));
  const list = /category in \(([^)]*)\)/.exec(migration)?.[1] ?? '';
  const database = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);

  assert.ok(app.length > 0);
  assert.deepEqual(app, database);
});
