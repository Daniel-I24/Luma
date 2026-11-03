/**
 * Lint of the Edge Functions with the same limits as the app, in warning
 * mode: deno lint (supabase/functions/deno.lint.json: recommended rules plus
 * no-explicit-any, eqeqeq, no-eval, no-throw-literal, prefer-const) and the
 * 150-line limit per code file (tests included, as in the app). It prints
 * what it finds and exits 0; --strict exits 1 when something is found.
 * deno is optional: without it only the line limit runs.
 *
 *   node scripts/lint-functions.mjs [--strict]
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FUNCTIONS = join(ROOT, 'supabase', 'functions');
export const MAX_LINES = 150;

/** Code files (.ts) under a folder, recursively. */
export function codeFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return codeFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

/** Files longer than max lines: [{ file, lines }]. */
export function longFiles(files, read = (f) => readFileSync(f, 'utf8'), max = MAX_LINES) {
  return files
    .map((file) => ({ file, lines: read(file).replace(/\n$/, '').split('\n').length }))
    .filter((entry) => entry.lines > max);
}

function denoLint() {
  const run = spawnSync('deno', ['lint', '--config', 'deno.lint.json'], { cwd: FUNCTIONS, encoding: 'utf8' });
  if (run.error) return { ran: false, ok: true, output: '' };
  return { ran: true, ok: run.status === 0, output: `${run.stdout}${run.stderr}` };
}

function main() {
  const strict = process.argv.includes('--strict');
  const long = longFiles(codeFiles(FUNCTIONS));
  for (const { file, lines } of long) {
    process.stdout.write(`warning: ${relative(ROOT, file)} has ${lines} lines (max ${MAX_LINES})\n`);
  }
  const lint = denoLint();
  if (!lint.ran) process.stdout.write('deno not found: only the line limit was checked (CI runs deno lint)\n');
  if (!lint.ok) process.stdout.write(`warning: deno lint found problems\n${lint.output}`);
  const found = long.length > 0 || !lint.ok;
  process.stdout.write(found ? 'lint:functions: warnings above\n' : 'lint:functions: clean\n');
  process.exitCode = strict && found ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
