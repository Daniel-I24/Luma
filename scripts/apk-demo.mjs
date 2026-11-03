#!/usr/bin/env node
/**
 * Demonstrates the whole release path WITHOUT the owner's keystore:
 *   1. creates a throwaway keystore (random passwords, 1 day validity) in a
 *      new temporary folder outside the repository;
 *   2. runs `node scripts/apk.mjs release` with it (build, sign, apksigner);
 *   3. deletes the temporary folder, whatever happened, and puts back the
 *      gitignored environment.deploy.ts the build overwrote (copied aside
 *      before, never printed).
 * The demo APK points to a placeholder backend and is deleted at the end.
 *
 *   node scripts/apk-demo.mjs
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveJavaHome } from './apk.mjs';

/** What the demo leaves behind and removes, so its APK is never published by mistake. */
export const DEMO_OUTPUTS = ['android/app/build/outputs/apk/release/app-release.apk', 'dist/apk-release.json'];

/** Variables of a demo release build (placeholder backend, throwaway key). */
export function demoEnv(base, keystorePath, password) {
  return {
    ...base,
    SUPABASE_URL: 'https://demo-placeholder.supabase.co',
    SUPABASE_ANON_KEY: 'demo-placeholder-anon-key',
    LUMA_KEYSTORE_PATH: keystorePath,
    LUMA_KEYSTORE_PASSWORD: password,
    LUMA_KEY_ALIAS: 'luma-demo',
    LUMA_KEY_PASSWORD: password,
  };
}

export function keytoolArgs(keystorePath, password) {
  return [
    '-genkeypair', '-noprompt', '-keystore', keystorePath, '-storetype', 'PKCS12',
    '-alias', 'luma-demo', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '1',
    '-storepass', password, '-keypass', password, '-dname', 'CN=Luma Demo Throwaway, O=Luma Demo',
  ];
}

function main() {
  const dir = mkdtempSync(join(tmpdir(), 'luma-apk-demo-'));
  const keystore = join(dir, 'demo.p12');
  const password = randomBytes(18).toString('base64url');
  // The JDK apk.mjs will build with; no shell, so spaces in the path are safe.
  const keytool = join(resolveJavaHome(process.env, process.platform), 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool');
  const deployEnv = 'src/environments/environment.deploy.ts';
  const saved = join(dir, 'environment.deploy.ts');
  if (existsSync(deployEnv)) copyFileSync(deployEnv, saved);
  try {
    const key = spawnSync(keytool, keytoolArgs(keystore, password), { stdio: 'ignore' });
    if (key.status !== 0) throw new Error('keytool could not create the throwaway keystore.');
    const build = spawnSync('node', ['scripts/apk.mjs', 'release'], { stdio: 'inherit', env: demoEnv(process.env, keystore, password) });
    if (build.status !== 0) throw new Error('The demo release build failed (see above).');
    process.stdout.write('apk-demo: ok (throwaway signature; do not publish this APK)\n');
  } finally {
    if (existsSync(saved)) copyFileSync(saved, deployEnv);
    else rmSync(deployEnv, { force: true });
    rmSync(dir, { recursive: true, force: true });
    for (const output of DEMO_OUTPUTS) rmSync(output, { force: true });
    process.stdout.write('apk-demo: throwaway keystore and demo APK deleted\n');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`apk-demo: ${error instanceof Error ? error.message : 'failed'}\n`);
    process.exitCode = 1;
  }
}
