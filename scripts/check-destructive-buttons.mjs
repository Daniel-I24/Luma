/**
 * Fails when a destructive action (cancel an order, reject, delete, remove,
 * discard, end, void, "No llegó") is not a `danger` button. Reads every
 * app-luma-button and app-luma-icon-button in src/app (templates and inline
 * templates) and the owner's order actions (key + variant pairs in TS).
 * docs/brand/button-semantics.md assigns a function to each variant.
 *
 *   node scripts/check-destructive-buttons.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP = join(ROOT, 'src', 'app');

/** Translation keys whose button destroys or cancels something. */
export const DESTRUCTIVE_KEYS = [
  /\.(reject|rejectConfirm|delete|deleteConfirm|confirmDelete|deleteAccount|remove|discard|end|endConfirm)$/,
  /\.(voidAction|cancelConfirm|noShow|noShowConfirm)$/,
  /^orders\.detail\.cancel$/,
  /^businessOrders\.actions\.cancel$/,
  /^profile\.deleteSheet\.confirm$/,
  /^cart\.conflict\.confirm$/,
];
/** Keys built at run time that include a destructive choice (the variant must handle it). */
const DYNAMIC_DESTRUCTIVE = [/^admin\.review\.actions\.$/];

// Closing tags may be wrapped by the formatter ("</app-luma-button\n  >").
const BUTTON = /<app-luma-(?:icon-)?button\b([\s\S]*?)(?:\/>|>([\s\S]*?)<\/app-luma-(?:icon-)?button\s*>)/g;
const KEY = /t\(\s*'([^']+)'/g;
const ACTION_OBJECT = /key:\s*'([^']+)',\s*variant:\s*'([^']+)'/g;

const isDestructive = (key) => DESTRUCTIVE_KEYS.some((rule) => rule.test(key));

/** Problems in one source text: [{ line, key, variant }]. */
export function findProblems(text) {
  const problems = [];
  const lineOf = (index) => text.slice(0, index).split('\n').length;
  for (const match of text.matchAll(BUTTON)) {
    const [, attributes, body = ''] = match;
    const keys = [...`${attributes} ${body}`.matchAll(KEY)].map((k) => k[1]);
    const staticVariant = /\svariant="([^"]+)"/.exec(attributes)?.[1] ?? null;
    const boundVariant = /\[variant\]="([^"]+)"/.exec(attributes)?.[1] ?? null;
    const variant = staticVariant ?? boundVariant ?? 'primary';
    const needsDanger = keys.some(isDestructive) || keys.some((key) => DYNAMIC_DESTRUCTIVE.some((r) => r.test(key)));
    // A bound variant must at least be able to be 'danger'; a static one must be exactly 'danger'.
    const ok = boundVariant ? boundVariant.includes("'danger'") : variant === 'danger';
    if (needsDanger && !ok) problems.push({ line: lineOf(match.index), key: keys.join(', '), variant });
  }
  for (const match of text.matchAll(ACTION_OBJECT)) {
    const [, key, variant] = match;
    if (/^(reject|cancel|noShow|delete|remove|end|discard)$/.test(key) && variant !== 'danger') {
      problems.push({ line: lineOf(match.index), key, variant });
    }
  }
  return problems;
}

function* sources(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.(html|ts)$/.test(name) && !/\.spec\.ts$/.test(name)) yield path;
  }
}

export function scan() {
  const report = [];
  for (const path of sources(APP)) {
    for (const p of findProblems(readFileSync(path, 'utf8'))) {
      report.push(`${relative(ROOT, path)}:${p.line} "${p.key}" uses variant ${p.variant}, expected danger`);
    }
  }
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = scan();
  if (report.length) {
    process.stderr.write(`check-destructive-buttons: ${report.length} problem(s):\n${report.join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('check-destructive-buttons: ok\n');
}
