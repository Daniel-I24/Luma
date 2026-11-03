import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const script = read('./setup-push.ps1');
const common = read('./luma/common.ps1');
const push = read('./luma/push.ps1');

test('setup-push.ps1 is option 2 of luma.ps1, with the secrets folder under USERPROFILE', () => {
  assert.match(script, /Join-Path \$env:USERPROFILE 'luma-secrets'/);
  assert.match(script, /luma\\push\.ps1/);
  assert.match(script, /Invoke-LumaPush \$ProjectRef/);
  assert.match(push, /firebase-service-account\.json/);
  assert.match(push, /push-settings\.sql/);
});

test('the Supabase CLI runs through npx and deploys with --use-api (no Docker needed)', () => {
  assert.match(common, /& npx --yes supabase @args/);
  assert.match(common, /functions deploy \$name --use-api --project-ref \$ProjectRef/);
  assert.match(push, /Deploy-LumaFunctions \$ProjectRef @\('push-dispatch'\)/);
});

test('secrets go through a temporary file that is always removed, and are never printed', () => {
  assert.match(common, /secrets set --env-file \$temp/);
  assert.match(common, /finally \{\s*if \(Test-Path \$temp\) \{ Remove-Item \$temp -Force \}/);
  const printing = [...push.split(/\r?\n/), ...script.split(/\r?\n/)].filter((line) => /Write-Host|Say /.test(line));
  assert.equal(printing.some((line) => /\$secret|\$oneLine|private_key\)/.test(line)), false);
});

const shell = ['pwsh', 'powershell'].find((name) => spawnSync(name, ['-NoProfile', '-Command', 'exit 0']).status === 0);

test('every PowerShell script parses', { skip: shell ? false : 'PowerShell is not installed' }, () => {
  const dir = fileURLToPath(new URL('.', import.meta.url));
  const files = ['luma.ps1', 'setup-push.ps1', ...readdirSync(`${dir}luma`).map((f) => `luma/${f}`)].map((f) => `${dir}${f}`);
  const command = files.map((f) => `$e=$null; [void][Management.Automation.Language.Parser]::ParseFile('${f}', [ref]$null, [ref]$e); if ($e) { Write-Output "${f}: $e" }`).join('; ');
  const run = spawnSync(shell, ['-NoProfile', '-Command', command], { encoding: 'utf8' });
  assert.equal(run.stdout.trim(), '');
});
