import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { run, unvalidated } from './check-validation.mjs';

const names = (html) => unvalidated(html).map((f) => `${f.line}:${f.tag}:${f.name}`);

test('text fields need a visible error: [errorMessage] or aria-invalid', () => {
  assert.deepEqual(names('<app-luma-input inputId="a" [value]="v()" />'), ['1:app-luma-input:a']);
  assert.deepEqual(names('<app-luma-input inputId="a" [errorMessage]="e()" />'), []);
  assert.deepEqual(names('<textarea id="n" [value]="v()"></textarea>\n<input [id]="\'x-\' + i" />'), ['1:textarea:n', "2:input:'x-' + i"]);
  assert.deepEqual(names('<textarea id="n" [attr.aria-invalid]="bad() ? \'true\' : null"></textarea>'), []);
  assert.deepEqual(names('<app-luma-select selectId="s" />'), ['1:app-luma-select:s']);
});

test('checkboxes, radios, files and hidden inputs carry no text', () => {
  assert.deepEqual(names('<input type="checkbox" /><input type="radio" /><input type="file" /><input type="hidden" />'), []);
  assert.deepEqual(names('<input type="email" id="e" />'), ['1:input:e']);
});

function app(files) {
  const root = mkdtempSync(join(tmpdir(), 'check-validation-'));
  for (const [path, source] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), source);
  }
  return root;
}

test('a field without a validator fails unless it is listed with a reason', () => {
  const root = app({
    'src/app/a.html': '<app-luma-input inputId="name" />',
    'src/app/b.ts': "@Component({ template: `<textarea id=\"note\"></textarea>` })",
    'src/app/c.spec.ts': "const t = `<input id=\"x\" />`;",
  });
  assert.equal(run(root, []).length, 2);
  assert.deepEqual(run(root, [
    { file: 'src/app/a.html', field: 'name', why: 'search' },
    { file: 'src/app/b.ts', field: 'note', why: 'parsed later' },
  ]), []);
});

test('stale or unexplained exceptions are reported, so the list stays true', () => {
  const root = app({ 'src/app/a.html': '<app-luma-input inputId="name" [errorMessage]="e()" />' });
  assert.deepEqual(run(root, [{ file: 'src/app/a.html', field: 'name', why: 'x' }]), [
    'src/app/a.html#name is listed as an exception but has no unvalidated field',
  ]);
  const bare = app({ 'src/app/a.html': '<app-luma-input inputId="name" />' });
  assert.deepEqual(run(bare, [{ file: 'src/app/a.html', field: 'name', why: ' ' }]), ['src/app/a.html#name is listed without a reason']);
});

test('the real app passes', () => {
  assert.deepEqual(run(), []);
});
