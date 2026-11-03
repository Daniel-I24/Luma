import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../src/app', import.meta.url));

function sources(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (path.endsWith('.ts') && !path.endsWith('.spec.ts')) out.push(path);
  }
  return out;
}

const files = sources(APP).map((path) => ({ path, text: readFileSync(path, 'utf8') }));

test('only zod/mini in app code (classic zod added 350 kB to the initial bundle)', () => {
  const classic = files.filter((f) => /from 'zod'/.test(f.text)).map((f) => f.path);
  assert.deepEqual(classic, []);
});

test('maplibre-gl is never imported by the app shell (it must stay in the lazy map chunks)', () => {
  const eager = ['app.ts', 'app.config.ts', 'app.routes.ts'].map((f) => readFileSync(join(APP, f), 'utf8'));
  assert.ok(eager.every((text) => !text.includes('maplibre-gl')));
});

test('the initial bundle budget stays tight', () => {
  const config = JSON.parse(readFileSync(new URL('../angular.json', import.meta.url), 'utf8'));
  const budgets = config.projects.luma.architect.build.configurations.production.budgets;
  const initial = budgets.find((b) => b.type === 'initial');
  assert.deepEqual([initial.maximumWarning, initial.maximumError], ['750kB', '900kB']);
});
