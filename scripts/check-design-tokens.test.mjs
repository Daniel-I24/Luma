import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findLiterals, scan } from './check-design-tokens.mjs';

const values = (text, extension) => findLiterals(text, extension).map((f) => f.value);

test('finds literal colours and px in CSS and templates', () => {
  assert.deepEqual(values('.a { color: #fff; border: 1px solid rgb(0 0 0); padding: 0px; }', '.css'), [
    '#fff',
    'rgb(',
    '1px',
  ]);
  assert.deepEqual(values('<div class="w-[12px] bg-[#0d4a6b]"></div>', '.html'), ['#0d4a6b', '12px']);
  assert.deepEqual(values('.a { font-size: 0.875rem; letter-spacing: 0.02em; margin: 0em; }', '.css'), ['0.875rem', '0.02em']);
  assert.deepEqual(values('.a { color: var(--color-fg); width: var(--spacing-4); }', '.css'), []);
});

test('in TS only string literals count, and comments never do', () => {
  const source = [
    "// 24px grid, #fff on #000",
    "/** Size 44px. */",
    "const width = `${size}px`;",
    "el.style.color = '#c42839';",
    "template: `<span class=\"h-[3px]\"></span>`,",
    "const id = '#main-content';",
  ].join('\n');
  assert.deepEqual(findLiterals(source, '.ts'), [
    { line: 4, value: '#c42839' },
    { line: 5, value: '3px' },
  ]);
  assert.deepEqual(values('<!-- 2px #abc --><p></p>', '.html'), []);
});

test('the app uses tokens only', () => {
  assert.deepEqual(scan(), []);
});
