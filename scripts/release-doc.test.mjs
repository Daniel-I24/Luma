import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const BUILD = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'AI_MODE', 'PUSH_ENABLED', 'SUPPORT_WHATSAPP', 'LEGAL_CONTACT_EMAIL'];
const SIGNING = ['LUMA_KEYSTORE_PATH', 'LUMA_KEYSTORE_PASSWORD', 'LUMA_KEY_ALIAS', 'LUMA_KEY_PASSWORD'];

test('every variable the build scripts read is in docs/release.md', () => {
  const scripts = ['./build-flags.mjs', './apk.mjs', './generate-env.mjs'].map(read).join('\n');
  const used = new Set([...scripts.matchAll(/env\.([A-Z][A-Z0-9_]{3,})/g)].map((m) => m[1]));
  const doc = read('../docs/release.md');
  for (const name of [...BUILD, ...SIGNING]) {
    assert.ok(used.has(name) || scripts.includes(`'${name}'`), `${name} is read by the scripts`);
    assert.match(doc, new RegExp(`\\| \`${name}\` \\|`), `${name} has a row in docs/release.md`);
  }
});

test('option 6 of luma.ps1 passes the same variables to the build', () => {
  const apk = read('./luma/apk.ps1');
  for (const name of [...BUILD, ...SIGNING]) assert.match(apk, new RegExp(`'${name}'`), name);
});
