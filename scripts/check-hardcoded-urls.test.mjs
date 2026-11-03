import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findUrls, isExempt, scan } from './check-hardcoded-urls.mjs';

test('finds http and https URLs in code, not in comments or allowed namespaces', () => {
  const text = [
    "const a = 'https://api.example.com/v1';",
    '// see https://docs.example.com',
    ' * https://in.a.jsdoc',
    "const ns = 'http://www.w3.org/2000/svg';",
    'fetch(`http://plain.example/${id}`);',
  ].join('\n');
  assert.deepEqual(findUrls(text), [
    { line: 1, url: 'https://api.example.com/v1' },
    { line: 5, url: 'http://plain.example/${id}' },
  ]);
});

test('tests, environments and the config modules are exempt', () => {
  assert.equal(isExempt('src/environments/environment.ts'), true);
  assert.equal(isExempt('src/app/x.spec.ts'), true);
  assert.equal(isExempt('supabase/functions/a/handler.test.ts'), true);
  assert.equal(isExempt('src/app/core/config/external-urls.ts'), true);
  assert.equal(isExempt('supabase/functions/_shared/config/provider-urls.ts'), true);
  assert.equal(isExempt('src/app/core/config/other.ts'), false);
  assert.equal(isExempt('supabase/functions/geocode/providers.ts'), false);
});

test('the repository has no URL outside the config modules', () => {
  assert.deepEqual(scan(), []);
});
