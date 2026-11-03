import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { codeFiles, longFiles, MAX_LINES } from './lint-functions.mjs';

const FUNCTIONS = fileURLToPath(new URL('../supabase/functions', import.meta.url));

test('reports only files over the 150-line limit', () => {
  const text = { 'a.ts': 'x\n'.repeat(MAX_LINES), 'b.ts': 'x\n'.repeat(MAX_LINES + 1) };
  assert.deepEqual(longFiles(Object.keys(text), (f) => text[f]), [{ file: 'b.ts', lines: MAX_LINES + 1 }]);
});

test('scans every TypeScript file of the Edge Functions, shared code included', () => {
  const files = codeFiles(FUNCTIONS);
  assert.ok(files.includes(join(FUNCTIONS, '_shared', 'payments', 'reconciler.ts')));
  assert.ok(files.every((f) => f.endsWith('.ts')));
});
