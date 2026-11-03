#!/usr/bin/env node
/**
 * Every form field of the Angular templates (.html files and inline
 * `template:` blocks) must show a validation error, so no field reaches the
 * database without a validator (docs/validation-matrix.md):
 *   - <app-luma-input>, <app-luma-select>: an [errorMessage] binding;
 *   - <input>, <textarea>, <select>: an aria-invalid binding;
 *   - checkboxes, radios, files, ranges and hidden inputs carry no text and
 *     are skipped.
 * A field without a validator must be listed, with its reason, in
 * scripts/check-validation.exceptions.mjs; a listed field that no longer
 * exists (or now has a validator) is reported too, so the list stays true.
 * Exit 1 with file:line for each problem. `node scripts/check-validation.mjs`
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inlineTemplates, tags } from './check-interactive.mjs';
import { EXCEPTIONS } from './check-validation.exceptions.mjs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FIELDS = new Set(['app-luma-input', 'app-luma-select', 'input', 'textarea', 'select']);
const NO_TEXT = new Set(['checkbox', 'radio', 'file', 'range', 'hidden', 'submit', 'button']);

const attr = (attrs, ...names) => {
  for (const name of names) {
    const m = new RegExp(`(?:^|\\s)${name.replace(/[[\]()]/g, '\\$&')}\\s*=\\s*"([^"]*)"`).exec(attrs);
    if (m) return m[1];
  }
  return null;
};

/** The name that identifies a field: its id (static or bound) or, failing that, its placeholder binding. */
export function fieldName(attrs) {
  return attr(attrs, 'inputId', '[inputId]', 'selectId', '[selectId]', 'id', '[id]', 'fieldId') ?? attr(attrs, '[placeholder]', 'placeholder') ?? '?';
}

/** Fields without a validator in one template: [{ line, name, tag }]. */
export function unvalidated(source) {
  const found = [];
  for (const { name, attrs, line } of tags(source)) {
    if (!FIELDS.has(name)) continue;
    if (name === 'input' && NO_TEXT.has(attr(attrs, 'type') ?? 'text')) continue;
    const validated = name.startsWith('app-luma-') ? /\[errorMessage\]\s*=/.test(attrs) : /aria-invalid/.test(attrs);
    if (!validated) found.push({ line, name: fieldName(attrs), tag: name });
  }
  return found;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

/** Problems of the whole app against the exception list. */
export function run(root = ROOT, exceptions = EXCEPTIONS) {
  const files = walk(join(root, 'src', 'app')).filter((f) => !f.endsWith('.spec.ts'));
  const listed = new Map(exceptions.map((e) => [`${e.file}#${e.field}`, e]));
  const used = new Set();
  const problems = [];
  for (const file of files) {
    const rel = relative(root, file).replaceAll('\\', '/');
    const templates = file.endsWith('.html')
      ? [{ source: readFileSync(file, 'utf8'), offset: 0 }]
      : file.endsWith('.ts') ? inlineTemplates(readFileSync(file, 'utf8')) : [];
    for (const t of templates) {
      for (const field of unvalidated(t.source)) {
        const key = `${rel}#${field.name}`;
        if (listed.has(key)) used.add(key);
        else problems.push(`${rel}:${t.offset + field.line} <${field.tag}> "${field.name}" has no validator (add one or list it in scripts/check-validation.exceptions.mjs)`);
      }
    }
  }
  for (const key of listed.keys()) if (!used.has(key)) problems.push(`${key} is listed as an exception but has no unvalidated field`);
  for (const e of exceptions) if (!e.why?.trim()) problems.push(`${e.file}#${e.field} is listed without a reason`);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = run();
  for (const problem of problems) process.stdout.write(`${problem}\n`);
  process.stdout.write(problems.length ? `check-validation: ${problems.length} problem(s)\n` : 'check-validation: ok\n');
  process.exitCode = problems.length ? 1 : 0;
}
