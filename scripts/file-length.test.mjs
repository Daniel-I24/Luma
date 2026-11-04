import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

/** At most 150 lines per code file (CLAUDE.md), also where ESLint does not look. */
const LIMIT = 150;
const CODE = /\.(ts|html|css|mjs|ps1)$/;
const ROOTS = ['src', 'e2e', 'scripts', 'supabase/functions', 'eslint'];

test('no code file is longer than 150 lines (app, tests, scripts, functions, styles)', () => {
  const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', ...ROOTS], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => CODE.test(f) && existsSync(f));
  const long = files
    .map((f) => [f, readFileSync(f, 'utf8').replace(/\n$/, '').split('\n').length])
    .filter(([, lines]) => lines > LIMIT);
  assert.deepEqual(long, []);
});
