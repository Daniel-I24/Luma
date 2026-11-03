#!/usr/bin/env node
/**
 * Checks a built release APK before it is published:
 *   - `apksigner verify --print-certs` (Android SDK build-tools) passes;
 *   - it is NOT signed with the Android debug certificate;
 *   - prints and writes its SHA-256 and size to dist/apk-release.json, ready
 *     for the "apk" entry of public/version.json (the /download page).
 *
 *   node scripts/apk-verify.mjs [path/to/app-release.apk]
 *
 * Never prints passwords (it needs none: verification uses the public cert).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export class VerifyApkError extends Error {}

export const DEFAULT_APK = 'android/app/build/outputs/apk/release/app-release.apk';

/** Newest build-tools apksigner under the SDK, or null. */
export function findApksigner(env, platform, list = (dir) => (existsSync(dir) ? readdirSync(dir) : [])) {
  const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
  if (!sdk) return null;
  const tools = join(sdk, 'build-tools');
  const versions = list(tools)
    .filter((v) => /^\d+\.\d+\.\d+/.test(v))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  if (!versions.length) return null;
  return join(tools, versions[0], platform === 'win32' ? 'apksigner.bat' : 'apksigner');
}

/** Reads the apksigner report: refuses a failed check and the debug certificate. */
export function checkReport(status, output) {
  if (status !== 0) throw new VerifyApkError('apksigner verify failed: the APK is not correctly signed.');
  if (/CN=Android Debug/i.test(output)) throw new VerifyApkError('The APK is signed with the debug certificate.');
  const digest = /certificate SHA-256 digest:\s*([0-9a-f]{64})/i.exec(output)?.[1] ?? null;
  if (!digest) throw new VerifyApkError('apksigner did not report a signer certificate.');
  return digest.toLowerCase();
}

export function describeApk(bytes, version, certificate) {
  return {
    version,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size: bytes.length,
    certificate,
  };
}

function main(apkPath = DEFAULT_APK) {
  if (!existsSync(apkPath) || !statSync(apkPath).isFile()) throw new VerifyApkError(`No APK at ${apkPath}.`);
  const apksigner = findApksigner(process.env, process.platform);
  if (!apksigner || !existsSync(apksigner)) throw new VerifyApkError('apksigner not found: set ANDROID_HOME to the Android SDK.');
  const result = spawnSync(apksigner, ['verify', '--print-certs', apkPath], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const certificate = checkReport(result.status, `${result.stdout ?? ''}${result.stderr ?? ''}`);
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  const info = describeApk(readFileSync(apkPath), version, certificate);
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/apk-release.json', `${JSON.stringify(info, null, 2)}\n`);
  process.stdout.write(`apk-verify: ok ${version}, ${info.size} bytes\nSHA-256 ${info.sha256}\nsigner ${certificate}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv[2]);
  } catch (error) {
    process.stderr.write(`apk-verify: ${error instanceof VerifyApkError ? error.message : 'unexpected error'}\n`);
    process.exitCode = 1;
  }
}
