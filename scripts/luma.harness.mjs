/**
 * Harness of scripts/luma.test.mjs: runs one option of scripts/luma.ps1 in
 * PowerShell with simulated services (Supabase CLI, web, questions, npm, adb).
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const here = fileURLToPath(new URL('.', import.meta.url));
export const shell = ['pwsh', 'powershell'].find((name) => spawnSync(name, ['-NoProfile', '-Command', 'exit 0']).status === 0);
export const skip = shell ? false : 'PowerShell is not installed';
export const REF = 'abcdefghijklmnopqrst';

/**
 * Runs one option of scripts/luma.ps1 with simulated services: the Supabase
 * CLI, the web, the questions, npm and adb are replaced; nothing leaves the machine.
 * The simulated project keeps what the CLI loaded: `applies: false` is a CLI that
 * answers 0 and changes nothing, `oldSecrets` and `oldFunctions` were already there.
 */
export function runOption(call, { files = {}, answers = [], http = {}, cli = 0, npm = 0, phones = [], applies = true, oldSecrets = [], oldFunctions = [], unchanged = [], failDeploy = '', unreadable = false, apkFresh = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'luma-secrets-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  const harness = join(mkdtempSync(join(tmpdir(), 'luma-harness-')), 'harness.ps1');
  const list = (values) => values.map((v) => `'${v}'`).join(', ');
  writeFileSync(harness, `
$ErrorActionPreference = 'Stop'
$env:LUMA_SECRETS_DIR = '${dir}'
foreach ($part in 'common', 'remote', 'ai', 'push', 'payments', 'routes', 'whatsapp', 'apk', 'doctor', 'all') { . (Join-Path '${join(here, 'luma')}' "$part.ps1") }
$global:calls = @(); $global:answers = [Collections.ArrayList]@(${list(answers)}); $global:envFiles = @()
$old = [DateTimeOffset]::UtcNow.AddDays(-30)
$global:remoteSecrets = @{ SUPABASE_URL = $old }; $global:remoteFunctions = @{ other = $old }
foreach ($n in @(${list(oldSecrets) || "''"})) { if ($n) { $global:remoteSecrets[$n] = $old } }
foreach ($n in @(${list(oldFunctions) || "''"})) { if ($n) { $global:remoteFunctions[$n] = $old } }
$global:skip = @(${list(unchanged) || "''"})
function Invoke-Supabase {
  $i = [array]::IndexOf($args, '--env-file')
  $code = ${cli}
  if ($i -ge 0) {
    $text = [IO.File]::ReadAllText($args[$i + 1]); $global:envFiles += $text; $global:tempFile = $args[$i + 1]
    if ($${applies} -and $code -eq 0) { foreach ($m in [regex]::Matches($text, '(?m)^([A-Z0-9_]+)=')) { $global:remoteSecrets[$m.Groups[1].Value] = [DateTimeOffset]::UtcNow } }
  }
  $global:calls += ($args -join ' ')
  $script:LumaCliOutput = ''
  if ($args[0] -eq 'functions' -and $args[1] -eq 'deploy') {
    if ($args[2] -eq '${failDeploy}') { return 1 }
    if ($global:skip -contains $args[2]) { $script:LumaCliOutput = 'No change found in Function' }
    elseif ($${applies} -and $code -eq 0) { $global:remoteFunctions[$args[2]] = [DateTimeOffset]::UtcNow }
  }
  return $code
}
function Invoke-SupabaseJson {
  if ($${unreadable}) { return $null }
  if ($args[0] -eq 'secrets') { return @($global:remoteSecrets.Keys | ForEach-Object { [pscustomobject]@{ name = $_; value = 'digest'; updated_at = $global:remoteSecrets[$_].ToString('o') } }) }
  return @($global:remoteFunctions.Keys | ForEach-Object { [pscustomobject]@{ slug = $_; status = 'ACTIVE'; updated_at = $global:remoteFunctions[$_].ToUnixTimeMilliseconds() } })
}
function Test-LumaApkFresh { return $${apkFresh} }
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
function Invoke-LumaNpm { $global:calls += "npm $($args -join ' ') AI_MODE=$env:AI_MODE TOKEN=$env:SUPABASE_ACCESS_TOKEN"; return ${npm} }
function Invoke-LumaAdb { $global:calls += "adb $($args -join ' ')"; if ($args[0] -eq 'devices') { return @('List of devices attached'${phones.map((p) => `, "${p.includes(' ') ? p.replace(' ', '`t') : `${p}\`tdevice`}"`).join('')}) }; return 'Success' }
$lines = ${call}
$tempLeft = $global:tempFile -and (Test-Path $global:tempFile)
$global:calls += "after TOKEN=$env:SUPABASE_ACCESS_TOKEN"
Write-Output (ConvertTo-Json -Depth 5 -Compress -InputObject @{ lines = @($lines | ForEach-Object { @{ state = $_.State; item = $_.Item; next = $_.Next } }); calls = @($global:calls); envFiles = @($global:envFiles); tempLeft = [bool]$tempLeft })
`);
  const run = spawnSync(shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', harness], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout.trim().split(/\r?\n/).at(-1));
  // What the option printed: everything but the harness's own JSON line.
  const printed = run.stdout.trim().split(/\r?\n/).slice(0, -1).join('\n');
  return { ...result, stdout: printed, dir, file: (name) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), 'utf8') : null) };
}

export const states = (r) => r.lines.map((l) => l.state);
