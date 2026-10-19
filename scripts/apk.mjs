#!/usr/bin/env node
/**
 * Builds the Android APK: `npm run apk:debug` or `npm run apk:release`.
 *   1. web build with the deploy environment (SUPABASE_URL, SUPABASE_ANON_KEY),
 *   2. `npx cap sync android`,
 *   3. `gradlew assembleDebug` / `assembleRelease`.
 * Release signing comes only from LUMA_KEYSTORE_PATH, LUMA_KEYSTORE_PASSWORD,
 * LUMA_KEY_ALIAS and LUMA_KEY_PASSWORD (the keystore never goes to git).
 * An invalid JAVA_HOME (or one Gradle cannot run) is replaced by the JBR of
 * Android Studio, or another installed JDK, when its version is compatible.
 * Never prints passwords.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export class ApkError extends Error {}

export const SIGNING_VARS = [
  'LUMA_KEYSTORE_PATH',
  'LUMA_KEYSTORE_PASSWORD',
  'LUMA_KEY_ALIAS',
  'LUMA_KEY_PASSWORD',
];

/** Gradle 8.14 (android/gradle/wrapper) runs on JDK 17 to 24. */
export const JDK_MIN = 17;
export const JDK_MAX = 24;

/** Where Android Studio keeps its JBR and where JDKs are usually installed. */
export function jdkCandidates(platform, env, list = () => []) {
  if (platform === 'win32') {
    const roots = [env.ProgramFiles, env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Programs')].filter(
      Boolean,
    );
    const jbrs = roots.map((root) => join(root, 'Android', 'Android Studio', 'jbr'));
    const vendors = ['Eclipse Adoptium', 'Microsoft', 'Java', 'Zulu'].map((v) =>
      join(env.ProgramFiles ?? '', v),
    );
    return [...jbrs, ...vendors.flatMap((dir) => list(dir).map((name) => join(dir, name)))];
  }
  if (platform === 'darwin') {
    const dir = '/Library/Java/JavaVirtualMachines';
    return [
      '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
      ...list(dir).map((name) => join(dir, name, 'Contents', 'Home')),
    ];
  }
  return [
    '/opt/android-studio/jbr',
    join(env.HOME ?? '', 'android-studio', 'jbr'),
    ...list('/usr/lib/jvm').map((n) => join('/usr/lib/jvm', n)),
  ];
}

/** Major version of a JDK home (from its "release" file), or null when it is not a JDK. */
export function jdkMajor(dir, platform, exists = existsSync, read = readText) {
  if (!dir || !exists(join(dir, 'bin', platform === 'win32' ? 'java.exe' : 'java'))) return null;
  const match = /JAVA_VERSION="(\d+)/.exec(read(join(dir, 'release')) ?? '');
  return match ? Number(match[1]) : null;
}

/** JAVA_HOME when it is a usable JDK, else the first usable candidate; throws when none. */
export function resolveJavaHome(env, platform, fs = {}) {
  const { exists = existsSync, read = readText, list = listDir } = fs;
  const usable = (dir) => {
    const major = jdkMajor(dir, platform, exists, read);
    return major !== null && major >= JDK_MIN && major <= JDK_MAX;
  };
  if (usable(env.JAVA_HOME)) return env.JAVA_HOME;
  const found = jdkCandidates(platform, env, list).find(usable);
  if (!found) {
    throw new ApkError(
      `No JDK ${JDK_MIN}-${JDK_MAX} found: set JAVA_HOME (Android Studio's JBR is used when compatible).`,
    );
  }
  return found;
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function listDir(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

/** Checks the signing variables for a release build (never returns their values). */
export function checkSigning(env, exists = existsSync) {
  const missing = SIGNING_VARS.filter((name) => !env[name]?.trim());
  if (missing.length) throw new ApkError(`Release signing needs: ${missing.join(', ')}.`);
  if (!exists(env.LUMA_KEYSTORE_PATH))
    throw new ApkError('LUMA_KEYSTORE_PATH does not point to a file.');
}

function run(command, args, options) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.status !== 0) throw new ApkError(`${command} ${args.join(' ')} failed.`);
}

function main(mode) {
  if (mode !== 'debug' && mode !== 'release')
    throw new ApkError('Usage: node scripts/apk.mjs debug|release');
  if (mode === 'release') checkSigning(process.env);
  const javaHome = resolveJavaHome(process.env, process.platform);
  const env = { ...process.env, JAVA_HOME: javaHome };
  run('node', ['scripts/generate-env.mjs'], { env });
  run('npx', ['ng', 'build', '--configuration', 'production,deploy'], { env });
  run('npx', ['cap', 'sync', 'android'], { env });
  const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  run(gradlew, [mode === 'release' ? 'assembleRelease' : 'assembleDebug'], { cwd: 'android', env });
  const apk = mode === 'release' ? 'release/app-release.apk' : 'debug/app-debug.apk';
  process.stdout.write(`APK: android/app/build/outputs/apk/${apk}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main(process.argv[2]);
  } catch (error) {
    process.stderr.write(`${error instanceof ApkError ? error.message : 'APK build failed.'}\n`);
    process.exitCode = 1;
  }
}
