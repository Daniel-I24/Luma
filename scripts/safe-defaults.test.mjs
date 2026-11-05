import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// Everything that costs money or needs an outside service is off unless the
// owner turns it on (docs/launch-checklist.md).
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const migrations = readdirSync(join(ROOT, 'supabase', 'migrations')).map((f) => read(join('supabase', 'migrations', f))).join('\n');

test('database switches start at 0: online payments and phone verification', () => {
  assert.match(migrations, /\('payments_enabled', 0\)/);
  assert.match(migrations, /\('require_phone_verification', 0\)/);
  assert.doesNotMatch(migrations, /set int_value = 1 where key = '(payments_enabled|require_phone_verification)'/);
});

test('app switches: push off, AI by rules, phone verification off unless the build says otherwise', () => {
  // Round 8: push and AI come from the build (scripts/build-flags.mjs); without a define they stay off.
  assert.match(read('src/app/core/push/push-types.ts'), /typeof LUMA_PUSH_ENABLED !== 'undefined' && LUMA_PUSH_ENABLED === 'true'/);
  assert.match(read('src/app/core/config/build-flags.ts'), /LUMA_AI_MODE === 'remote' \? 'remote' : 'rules'/);
  assert.match(read('src/app/core/config/build-flags.ts'), /factory: \(\) => false/);
});

test('no Firebase config is committed (push cannot start without it)', () => {
  assert.match(read('.gitignore'), /google-services\.json/);
});
