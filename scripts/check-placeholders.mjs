/**
 * Fails when a text field has no example: every <input>, <textarea>,
 * <app-luma-input> and <app-luma-search-input> needs a placeholder (an
 * "Ej.: …" translation key), and every <select> / <app-luma-select> a short
 * help (hint or aria-describedby). Reads templates and inline templates in
 * src/app. Fields where an example makes no sense are not text fields
 * (checkbox, radio, file, date and time pickers, hidden) or are listed in
 * EXCEPTIONS with the reason.
 *
 *   node scripts/check-placeholders.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP = join(ROOT, 'src', 'app');

/** Field ids (inputId / id) without an example, each with its reason. */
export const EXCEPTIONS = new Map([
  // A 6-digit code: the label and the hint already say what to type.
  ['delete-account-code', 'one-time code'],
  // Inline name and price of a product already show its current value.
  ['menu-name', 'shows the saved value'],
  ['menu-price', 'shows the saved value'],
  // Scanned items show what the scan read; an example would hide it.
  ['scan-name', 'shows the scanned value'],
  ['scan-price', 'shows the scanned value'],
  ['scan-section', 'shows the scanned value'],
  // Passwords: never an example password.
  ['password-current', 'password'],
  ['password-next', 'password'],
  ['recover-password', 'password'],
  // Choices from a fixed list in a compact place: the label says it all.
  ['owner-business-switch', "the owner's own businesses, next to their count"],
  ['hours', 'quarter hours of the day'],
]);

const NOT_TEXT = /\btype\s*=\s*"(?:checkbox|radio|file|hidden|range|color|date|time|datetime-local|month|week)"/;
const FIELD = /<(input|textarea|app-luma-input|app-luma-search-input|select|app-luma-select)\b([^>]*?)\/?>/gs;
const ID = /(?:\[?(?:inputId|selectId|id)\]?)\s*=\s*"([^"]+)"/;

/** Problems in one template: [{ tag, id, line, missing }]. */
export function findMissing(text) {
  const problems = [];
  for (const match of text.matchAll(FIELD)) {
    const [, tag, attrs] = match;
    if (NOT_TEXT.test(attrs)) continue;
    const rawId = attrs.match(ID)?.[1] ?? '';
    // Dynamic ids ("'menu-name-' + item.id") are known by their literal start.
    const id = rawId.replace(/^'([^']*)'.*$/, '$1').replace(/-$/, '');
    if (EXCEPTIONS.has(id)) continue;
    const select = tag === 'select' || tag === 'app-luma-select';
    const ok = select
      ? /\[?(?:placeholder|hint|aria-describedby|attr\.aria-describedby)\]?\s*=/.test(attrs)
      : /\[?placeholder\]?\s*=/.test(attrs);
    if (!ok) {
      const line = text.slice(0, match.index).split('\n').length;
      problems.push({ tag, id: id || '(no id)', line, missing: select ? 'help' : 'placeholder' });
    }
  }
  return problems;
}

function* templates(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* templates(path);
    else if (name.endsWith('.html') || (name.endsWith('.ts') && !name.endsWith('.spec.ts'))) yield path;
  }
}

/** Every problem of src/app, with its file. */
export function scan(root = APP) {
  const all = [];
  for (const path of templates(root)) {
    const text = readFileSync(path, 'utf8');
    // Design-system fields get their texts from the caller.
    if (path.includes(`${sep}design-system${sep}`)) continue;
    for (const problem of findMissing(text)) all.push({ file: relative(ROOT, path), ...problem });
  }
  return all;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = scan();
  for (const p of problems) process.stdout.write(`${p.file}:${p.line} <${p.tag}> ${p.id}: no ${p.missing}\n`);
  process.stdout.write(problems.length ? `check-placeholders: ${problems.length} field(s)\n` : 'check-placeholders: ok\n');
  process.exitCode = problems.length ? 1 : 0;
}
