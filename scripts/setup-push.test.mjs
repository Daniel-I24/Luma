import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const script = readFileSync(new URL('./setup-push.ps1', import.meta.url), 'utf8');
const lines = script.split(/\r?\n/);

test('setup-push.ps1 reads the service account outside the repo and writes push-settings.sql there', () => {
  assert.match(script, /C:\\Users\\ivan2\\luma-secrets/);
  assert.match(script, /firebase-service-account\.json/);
  assert.match(script, /push-settings\.sql/);
  assert.match(script, /supabase functions deploy push-dispatch/);
});

test('secrets go through a temporary file that is always removed, and are never printed', () => {
  assert.match(script, /secrets set --env-file \$temp/);
  assert.match(script, /finally \{\s*if \(Test-Path \$temp\) \{ Remove-Item \$temp -Force \}/);
  const printing = lines.filter((line) => /Write-Host|Say /.test(line));
  assert.equal(printing.some((line) => /\$secret|\$oneLine|private_key\)/.test(line)), false);
});

test('short lines and messages in Spanish', () => {
  assert.equal(Math.max(...lines.map((line) => line.length)) <= 80, true);
  assert.match(script, /Secretos cargados/);
});
