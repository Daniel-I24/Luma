import assert from 'node:assert/strict';
import { test } from 'node:test';
import { historyKinds, scanLog } from './secret-scan-history.mjs';

// Values are assembled at run time so this file passes both scans.
const ref = 'abcdefghij'.repeat(2);

test('flags project references and personal e-mails, not fixtures', () => {
  assert.deepEqual(historyKinds(`url: 'https://${ref}.supabase.co'`), ['Supabase project reference']);
  assert.deepEqual(historyKinds(`postgresql://postgres.${ref}@aws-0.pooler.supabase.com`), ['Supabase project reference']);
  assert.deepEqual(historyKinds(`owner ${'ana.perez'}@${'gmail'}.com`), ['personal e-mail address']);
  for (const fine of ['https://placeholder.supabase.co', 'a@example.com', 'b@test.local', 'c@ejemplo.com', 'soporte@luma.app']) {
    assert.deepEqual(historyKinds(fine), [], fine);
  }
});

test('reads git log -p: commit, file, forbidden paths and added lines only', () => {
  const log = [
    'commit 1234567890abcdef',
    '+++ b/supabase/.temp/project-ref',
    `+${ref}`,
    'commit abcdef1234567890',
    '+++ b/src/app/x.ts',
    `-const old = 'https://${ref}.supabase.co';`,
    "+const ok = 'https://placeholder.supabase.co';",
  ].join('\n');
  assert.deepEqual(scanLog(log), ['1234567 supabase/.temp/project-ref: Supabase CLI link data (project reference)']);
});
