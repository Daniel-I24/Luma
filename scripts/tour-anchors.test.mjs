import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../src/app', import.meta.url));

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(html|ts)$/.test(name) && !name.endsWith('.spec.ts')) yield path;
  }
}

test('every guided-tour step points at a data-tour anchor that exists in a template', () => {
  const registry = readFileSync(join(ROOT, 'shared/tutorial/tour-registry.ts'), 'utf8');
  const anchors = new Set([...registry.matchAll(/anchor: '([a-z-]+)'/g)].map((m) => m[1]));
  const found = new Set();
  for (const path of files(ROOT)) {
    const text = readFileSync(path, 'utf8');
    for (const m of text.matchAll(/data-tour/g)) {
      const after = text.slice(m.index + 'data-tour'.length, m.index + 'data-tour'.length + 48);
      const name = after.match(/[a-z]+(?:-[a-z]+)+/);
      if (name) found.add(name[0]);
    }
  }
  const missing = [...anchors].filter((anchor) => !found.has(anchor));
  assert.deepEqual(missing, [], `steps without an anchor on screen: ${missing.join(', ')}`);
});
