/**
 * The real npm and adb helpers of scripts/luma/apk.ps1 (the option tests
 * replace them): npm's output goes to the screen and only the exit code
 * comes back; adb is found in the PATH, ANDROID_HOME or Android Studio's SDK.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { here, shell, skip } from './luma.harness.mjs';

function run(script, env = {}) {
  const file = join(mkdtempSync(join(tmpdir(), 'luma-tools-')), 'run.ps1');
  writeFileSync(file, `$ErrorActionPreference = 'Stop'
foreach ($part in 'common', 'apk') { . (Join-Path '${join(here, 'luma')}' "$part.ps1") }
if ($env:LUMA_TEST_PATH) { $env:PATH = $env:LUMA_TEST_PATH }
${script}`);
  const result = spawnSync(shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file], { encoding: 'utf8', env: { ...process.env, ...env } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim().split(/\r?\n/).at(-1);
}

test('Invoke-LumaNpm returns only the exit code as an integer (the output is shown, not returned)', { skip }, () => {
  const out = run(`function npm { Write-Output 'compilando...'; $global:LASTEXITCODE = 3 }
$code = Invoke-LumaNpm 'apk:debug'
Write-Output "$($code.GetType().Name)=$code"`);
  assert.equal(out, 'Int32=3');
});

test('Find-LumaAdb: ANDROID_HOME, then the Android Studio SDK under LOCALAPPDATA', { skip }, () => {
  const home = mkdtempSync(join(tmpdir(), 'android-home-'));
  mkdirSync(join(home, 'platform-tools'));
  writeFileSync(join(home, 'platform-tools', 'adb.exe'), '');
  const local = mkdtempSync(join(tmpdir(), 'local-app-data-'));
  mkdirSync(join(local, 'Android', 'Sdk', 'platform-tools'), { recursive: true });
  writeFileSync(join(local, 'Android', 'Sdk', 'platform-tools', 'adb.exe'), '');
  // Inside the script the PATH has no adb, so only the two folders can answer.
  const LUMA_TEST_PATH = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
  assert.equal(run('Write-Output (Find-LumaAdb)', { LUMA_TEST_PATH, ANDROID_HOME: home, LOCALAPPDATA: local }), join(home, 'platform-tools', 'adb.exe'));
  assert.equal(run('Write-Output (Find-LumaAdb)', { LUMA_TEST_PATH, ANDROID_HOME: '', LOCALAPPDATA: local }), join(local, 'Android', 'Sdk', 'platform-tools', 'adb.exe'));
  assert.equal(run('Write-Output "[$(Invoke-LumaAdb devices)]"', { LUMA_TEST_PATH, ANDROID_HOME: '', LOCALAPPDATA: home }), '[LUMA_NO_ADB]');
});
