import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const shell = ['pwsh', 'powershell'].find((name) => spawnSync(name, ['-NoProfile', '-Command', 'exit 0']).status === 0);
const skip = shell ? false : 'PowerShell is not installed';
const REF = 'abcdefghijklmnopqrst';

/**
 * Runs one option of scripts/luma.ps1 with simulated services: the Supabase
 * CLI, the web, the questions, npm and adb are replaced; nothing leaves the machine.
 */
function runOption(call, { files = {}, answers = [], http = {}, cli = 0, npm = 0, phones = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'luma-secrets-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  const harness = join(mkdtempSync(join(tmpdir(), 'luma-harness-')), 'harness.ps1');
  const list = (values) => values.map((v) => `'${v}'`).join(', ');
  writeFileSync(harness, `
$ErrorActionPreference = 'Stop'
$env:LUMA_SECRETS_DIR = '${dir}'
foreach ($part in 'common', 'ai', 'push', 'payments', 'routes', 'whatsapp', 'apk') { . (Join-Path '${join(here, 'luma')}' "$part.ps1") }
$global:calls = @(); $global:answers = [Collections.ArrayList]@(${list(answers)}); $global:envFiles = @()
function Invoke-Supabase {
  $i = [array]::IndexOf($args, '--env-file')
  if ($i -ge 0) { $global:envFiles += [IO.File]::ReadAllText($args[$i + 1]); $global:tempFile = $args[$i + 1] }
  $global:calls += ($args -join ' '); return ${cli}
}
function Read-LumaValue([string]$Prompt, [string]$Current = '', [switch]$Secret) {
  if ($global:answers.Count -eq 0) { return $Current }
  $a = $global:answers[0]; $global:answers.RemoveAt(0); if ($a -eq '') { return $Current }; return $a
}
$global:http = @{ ${Object.entries(http).map(([k, v]) => `'${k}' = @{ Status = ${v.status}; Body = '${v.body ?? ''}' }`).join('; ')} }
function Invoke-LumaHttp([string]$Uri, [hashtable]$Headers = @{}) {
  $global:calls += "HTTP $Uri"; $global:headers = $Headers
  foreach ($k in $global:http.Keys) { if ($Uri -like "*$k*") { $r = $global:http[$k]; if ($r.Body -eq 'ECHO') { return @{ Status = 200; Body = ([regex]::Match($Uri, 'hub.challenge=(\\d+)').Groups[1].Value) } }; return $r } }
  return @{ Status = 404; Body = '' }
}
function Invoke-LumaNpm { $global:calls += "npm $($args -join ' ') AI_MODE=$env:AI_MODE"; return ${npm} }
function Invoke-LumaAdb { $global:calls += "adb $($args -join ' ')"; if ($args[0] -eq 'devices') { return @('List of devices attached'${phones.map((p) => `, "${p}\`tdevice"`).join('')}) }; return 'Success' }
$lines = ${call}
$tempLeft = $global:tempFile -and (Test-Path $global:tempFile)
Write-Output (ConvertTo-Json -Depth 5 -Compress -InputObject @{ lines = @($lines | ForEach-Object { @{ state = $_.State; item = $_.Item; next = $_.Next } }); calls = @($global:calls); envFiles = @($global:envFiles); tempLeft = [bool]$tempLeft })
`);
  const run = spawnSync(shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', harness], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout.trim().split(/\r?\n/).at(-1));
  // What the option printed: everything but the harness's own JSON line.
  const printed = run.stdout.trim().split(/\r?\n/).slice(0, -1).join('\n');
  return { ...result, stdout: printed, dir, file: (name) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), 'utf8') : null) };
}

const states = (r) => r.lines.map((l) => l.state);

test('every PowerShell file is ASCII (PowerShell 5.1 reads them as ANSI) with short lines', { skip: false }, () => {
  for (const file of ['luma.ps1', 'setup-push.ps1', ...readdirSync(join(here, 'luma')).map((f) => `luma/${f}`)]) {
    const text = readFileSync(join(here, file), 'utf8');
    assert.equal(/[^\x00-\x7f]/.test(text), false, file);
    assert.equal(text.split(/\r?\n/).length <= 150, true, file);
    assert.equal(/ivan2|C:\\Users\\/.test(text), false, `${file}: no personal path`);
  }
});

test('option 3: Wompi keys found by their prefix in any order, secrets loaded, 4 functions deployed, SQL written', { skip }, () => {
  const text = 'Llave privada: prv_test_BBB\nEventos test_events_CCC y pub_test_AAA\nIntegridad: test_integrity_DDD\n';
  const r = runOption(`Invoke-LumaPayments '${REF}'`, { files: { 'wompi-sandbox.txt': text } });
  assert.match(r.envFiles[0], /WOMPI_PUBLIC_KEY='pub_test_AAA'/);
  assert.match(r.envFiles[0], /WOMPI_PRIVATE_KEY='prv_test_BBB'/);
  assert.match(r.envFiles[0], /WOMPI_EVENTS_SECRET='test_events_CCC'/);
  assert.match(r.envFiles[0], /WOMPI_INTEGRITY_SECRET='test_integrity_DDD'/);
  assert.match(r.envFiles[0], /WOMPI_ENV='test'/);
  const cron = /PAYMENTS_CRON_SECRET='([0-9a-f]{64})'/.exec(r.envFiles[0])[1];
  assert.equal(r.tempLeft, false, 'the temporary secrets file is removed');
  for (const name of ['create-payment', 'wompi-webhook', 'reconcile-payments', 'void-payment']) {
    assert.ok(r.calls.includes(`functions deploy ${name} --use-api --project-ref ${REF}`), name);
  }
  assert.match(r.file('payments-settings.sql'), new RegExp(`'${cron}'`));
  assert.ok(r.lines.some((l) => l.state === 'APAGADO' && /wompi-webhook/.test(l.next)), 'reminds the events URL');
  for (const secret of ['prv_test_BBB', 'test_events_CCC', 'test_integrity_DDD', cron]) assert.equal(r.stdout.includes(secret), false);

  const again = runOption(`Invoke-LumaPayments '${REF}'`, { files: { 'wompi-sandbox.txt': text, 'payments-settings.sql': r.file('payments-settings.sql') } });
  assert.match(again.envFiles[0], new RegExp(`PAYMENTS_CRON_SECRET='${cron}'`), 'repeating keeps the cron secret already pasted');
});

test('option 3 without all the keys says which prefix is missing and loads nothing', { skip }, () => {
  const r = runOption(`Invoke-LumaPayments '${REF}'`, { files: { 'wompi-sandbox.txt': 'pub_test_A prv_test_B' } });
  assert.deepEqual(states(r), ['FALTA']);
  assert.match(r.lines[0].item, /test_events_\.\.\., test_integrity_\.\.\./);
  assert.equal(r.calls.length, 0);
});

test('option 1: Gemini key and models tested, LLM_* loaded, the three AI functions deployed', { skip }, () => {
  const r = runOption(`Invoke-LumaAi '${REF}'`, {
    answers: ['AIza-clave', '', ''],
    http: { 'models/gemini-3.8-flash': { status: 200 }, 'models/gemini-3.1-flash-lite': { status: 200 } },
  });
  assert.match(r.envFiles[0], /LLM_PROVIDER='gemini'/);
  assert.match(r.envFiles[0], /LLM_FALLBACK_MODEL='gemini-3.1-flash-lite'/);
  for (const name of ['recommend', 'suggest-promotions', 'extract-menu']) assert.ok(r.calls.includes(`functions deploy ${name} --use-api --project-ref ${REF}`));
  assert.equal(r.calls.some((c) => c.startsWith('HTTP') && c.includes('AIza-clave')), false, 'the key goes in a header');
  assert.match(r.file('ai.env'), /LLM_API_KEY=AIza-clave/);
  assert.equal(r.stdout.includes('AIza-clave'), false);
  assert.equal(states(r).includes('FALTA'), false);
});

test('option 1 reports a model that does not exist and a refused key', { skip }, () => {
  const r = runOption(`Invoke-LumaAi '${REF}'`, { answers: ['k', 'gemini-x', '-'], http: { 'models/gemini-x': { status: 404 } } });
  assert.ok(r.lines.some((l) => l.state === 'FALTA' && /gemini-x no existe/.test(l.item)));
  assert.ok(r.lines.some((l) => l.state === 'APAGADO' && /respaldo/.test(l.item)));
});

test('option 2: push secrets, push-dispatch with --use-api and the SQL, keeping the secret on a repeat', { skip }, () => {
  const account = JSON.stringify({ type: 'service_account', project_id: 'luma-app', client_email: 'a@b.c', private_key: 'KEY' });
  const r = runOption(`Invoke-LumaPush '${REF}'`, { files: { 'firebase-service-account.json': account } });
  assert.match(r.envFiles[0], /FCM_SERVICE_ACCOUNT='\{.*"project_id":"luma-app".*\}'/);
  assert.ok(r.calls.includes(`functions deploy push-dispatch --use-api --project-ref ${REF}`));
  const secret = /PUSH_DISPATCH_SECRET='([0-9a-f]{64})'/.exec(r.envFiles[0])[1];
  assert.match(r.file('push-settings.sql'), new RegExp(secret));
  const again = runOption(`Invoke-LumaPush '${REF}'`, { files: { 'firebase-service-account.json': account, 'push-settings.sql': r.file('push-settings.sql') } });
  assert.match(again.envFiles[0], new RegExp(`PUSH_DISPATCH_SECRET='${secret}'`));
  assert.equal(r.stdout.includes(secret), false);
});

test('option 2 without the Firebase file says where to put it', { skip }, () => {
  const r = runOption(`Invoke-LumaPush '${REF}'`);
  assert.deepEqual(states(r), ['FALTA']);
  assert.match(r.lines[0].next, /luma-secrets/);
});

test('options 4 and 5: the route key and the WhatsApp challenge are tested', { skip }, () => {
  const routes = runOption(`Invoke-LumaRoutes '${REF}'`, { answers: ['ors-key'], http: { openrouteservice: { status: 200 } } });
  assert.ok(routes.calls.includes(`functions deploy route --use-api --project-ref ${REF}`));
  assert.equal(states(routes).includes('FALTA'), false);
  const env = 'WHATSAPP_APP_SECRET=s\nWHATSAPP_PHONE_NUMBER_ID=123\n';
  const wa = runOption(`Invoke-LumaWhatsapp '${REF}'`, { files: { 'whatsapp.env': env }, http: { 'whatsapp-webhook': { status: 200, body: 'ECHO' } } });
  assert.match(wa.file('whatsapp.env'), /WHATSAPP_VERIFY_TOKEN=[0-9a-f]{64}/, 'a missing verify token is generated and saved');
  assert.ok(wa.lines.some((l) => l.state === 'OK' && /reto de Meta/.test(l.item)));
});

test('option 6: app.env reaches the build, and with two phones it asks which', { skip }, () => {
  const app = 'SUPABASE_URL=https://x.supabase.co\nSUPABASE_ANON_KEY=anon\nAI_MODE=remote\n';
  const r = runOption('Invoke-LumaApk', { files: { 'app.env': app }, phones: ['AAA', 'BBB'], answers: ['2'] });
  assert.ok(r.calls.includes('npm apk:debug AI_MODE=remote'), 'without signing variables: a debug APK');
  assert.ok(r.calls.includes('adb -s BBB install -r android\\app\\build\\outputs\\apk\\debug\\app-debug.apk'));
  const none = runOption('Invoke-LumaApk', { files: { 'app.env': app } });
  assert.ok(none.lines.some((l) => l.state === 'FALTA' && /telefono conectado/.test(l.item)));
});
