import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runOption, skip, states } from './luma.harness.mjs';

/** Option 6 (scripts/luma/apk.ps1) when Gradle has nothing to rebuild. */
test('option 6: an APK Gradle reused counts when it is this version, and is installed', { skip }, () => {
  const app = 'SUPABASE_URL=https://x.supabase.co\nSUPABASE_ANON_KEY=anon\n';
  const same = runOption('Invoke-LumaApk', { files: { 'app.env': app }, phones: ['AAA'], apkFresh: false, apkVersion: '1.0.3' });
  assert.ok(same.lines.some((l) => l.state === 'OK' && /sin cambios/.test(l.item) && /1\.0\.3/.test(l.item)));
  assert.ok(same.calls.includes('adb -s AAA install -r android/app/build/outputs/apk/debug/app-debug.apk'));
  assert.equal(states(same).includes('FALTA'), false);
  const old = runOption('Invoke-LumaApk', { files: { 'app.env': app }, phones: ['AAA'], apkFresh: false, apkVersion: '1.0.2' });
  assert.ok(old.lines.some((l) => l.state === 'FALTA' && /version 1\.0\.3/.test(l.item)));
  assert.equal(old.calls.some((c) => c.startsWith('adb -s AAA install')), false);
});
