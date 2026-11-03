import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXCEPTIONS, findMissing, scan } from './check-placeholders.mjs';

test('text fields need an example, selects a help; pickers and listed fields do not', () => {
  const html = `
    <app-luma-input inputId="a" [label]="x" />
    <app-luma-input inputId="b" [placeholder]="t('placeholders.code')" />
    <textarea id="c"></textarea>
    <input type="checkbox" id="d" />
    <input type="datetime-local" id="e" />
    <app-luma-select selectId="f" [label]="x" />
    <app-luma-select selectId="g" [hint]="x" />
    <input [id]="'menu-name-' + item.id" />`;
  assert.deepEqual(findMissing(html).map((p) => [p.id, p.missing]), [['a', 'placeholder'], ['c', 'placeholder'], ['(no id)', 'help']]);
  assert.ok(EXCEPTIONS.has('menu-name'));
});

test('every field of the app has an example (the CI rule)', () => {
  assert.deepEqual(scan(), []);
});
