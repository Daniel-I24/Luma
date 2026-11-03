import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VerifyApkError, checkReport, describeApk, findApksigner } from './apk-verify.mjs';

const DIGEST = 'a'.repeat(64);
const report = (cn) => `Signer #1 certificate DN: CN=${cn}, O=Luma\nSigner #1 certificate SHA-256 digest: ${DIGEST}\n`;

test('finds the newest build-tools apksigner', () => {
  const list = () => ['34.0.0', '36.0.0', '35.0.0', 'tmp'];
  const path = findApksigner({ ANDROID_HOME: '/sdk' }, 'linux', list);
  assert.match(path.replaceAll('\\', '/'), /\/sdk\/build-tools\/36\.0\.0\/apksigner$/);
  assert.match(findApksigner({ ANDROID_HOME: 'C:\\sdk' }, 'win32', list), /apksigner\.bat$/);
  assert.equal(findApksigner({}, 'linux', list), null);
});

test('accepts a release signature and returns the signer digest', () => {
  assert.equal(checkReport(0, report('Luma Release')), DIGEST);
});

test('refuses failed checks, debug certificates and missing signers', () => {
  assert.throws(() => checkReport(1, ''), VerifyApkError);
  assert.throws(() => checkReport(0, report('Android Debug')), /debug certificate/);
  assert.throws(() => checkReport(0, 'Verifies\n'), /did not report/);
});

test('describes the APK for version.json', () => {
  const info = describeApk(Buffer.from('apk'), '1.0.0', DIGEST);
  assert.equal(info.sha256, 'dd37c2d7274f7ea982cb83390c36918fee9ce8889073c44b68cdc00bdb8c3e04');
  assert.deepEqual([info.version, info.size, info.certificate], ['1.0.0', 3, DIGEST]);
});

test('the demo uses a placeholder backend and a throwaway key outside the repo', async () => {
  const { demoEnv, keytoolArgs } = await import('./apk-demo.mjs');
  const env = demoEnv({ PATH: 'x' }, '/tmp/luma-apk-demo-1/demo.p12', 'pw');
  assert.equal(env.SUPABASE_URL, 'https://demo-placeholder.supabase.co');
  assert.equal(env.LUMA_KEYSTORE_PATH, '/tmp/luma-apk-demo-1/demo.p12');
  assert.ok(keytoolArgs('k', 'pw').includes('1'), 'one day of validity');
  assert.ok(keytoolArgs('k', 'pw').join(' ').includes('CN=Luma Demo Throwaway'));
});
