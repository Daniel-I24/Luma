/**
 * The real functions of scripts/luma/remote.ps1 with a fake npx.cmd: the arguments
 * and the exit code really arrive. And no real Wompi key in the repository.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { SUPABASE_CLI } from './doctor.mjs';
import { REF, here, shell } from './luma.harness.mjs';

const realCli = { skip: process.platform === 'win32' && shell ? false : 'needs Windows PowerShell and .cmd files' };

/** The real functions of remote.ps1 with a fake npx.cmd first in the PATH. */
function withFakeNpx(batch, script) {
  const bin = mkdtempSync(join(tmpdir(), 'luma-npx-'));
  writeFileSync(join(bin, 'npx.cmd'), `@echo off\r\n${batch}\r\n`);
  const file = join(bin, 'run.ps1');
  writeFileSync(file, `$ErrorActionPreference = 'Stop'
foreach ($part in 'common', 'remote') { . (Join-Path '${join(here, 'luma')}' "$part.ps1") }
$env:PATH = '${bin};' + $env:PATH
${script}`);
  return execFileSync(shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file], { encoding: 'utf8' }).trim().split(/\r?\n/).at(-1);
}

test('Invoke-Supabase: every argument reaches the CLI and its exit code comes back', realCli, () => {
  const out = withFakeNpx('echo ARGS=%*\r\nexit /b 7', `$code = Invoke-Supabase functions deploy route --use-api '--remote=${REF}' --yes
Write-Output "$code|$script:LumaCliOutput"`);
  assert.equal(out.split('|')[0], '7');
  assert.ok(out.includes(`ARGS=--yes ${SUPABASE_CLI} functions deploy route --use-api --remote=${REF} --yes`), out);
});

test('Get-LumaRemoteState reads the CLI answers, a list or the wrapped form, and fails to $null', realCli, () => {
  const out = withFakeNpx("exit /b 0", `
$state = & { function Invoke-SupabaseJson { if ($args[0] -eq 'secrets') { return @([pscustomobject]@{ name = 'A'; value = 'd'; updated_at = '2026-11-07T10:00:00Z' }) }; return [pscustomobject]@{ functions = @([pscustomobject]@{ slug = 'f'; status = 'ACTIVE'; updated_at = 1793653326445 }) } }; Get-LumaRemoteState '${REF}' }
Write-Output "$($state.Secrets['A'].Digest)|$($state.Functions['f'].Status)"`);
  assert.equal(out, 'd|ACTIVE');
  assert.equal(withFakeNpx('exit /b 1', `Write-Output "[$(Invoke-SupabaseJson secrets list)]"`), '[]');
});

test('the repository has no real Wompi key: prefixes and short invented values only', () => {
  const tracked = spawnSync('git', ['ls-files'], { encoding: 'utf8', cwd: join(here, '..') }).stdout.split('\n').filter(Boolean);
  const real = /(?:pub|prv)_(?:test|prod|stagtest)_[A-Za-z0-9]{20,}|(?:test|prod|stagtest)_(?:events|integrity)_[A-Za-z0-9]{20,}/;
  const found = tracked.filter((f) => {
    try { return real.test(readFileSync(join(here, '..', f), 'utf8')); } catch { return false; }
  });
  assert.deepEqual(found, []);
});
