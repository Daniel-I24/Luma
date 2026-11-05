#!/usr/bin/env node
/**
 * Compares the package_name of android/app/google-services.json with the
 * applicationId of the APK: when they differ FCM never gives a token. Reads
 * only that field and prints nothing else of the file.
 *
 *   npm run check:google-services
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const GOOGLE_SERVICES = 'android/app/google-services.json';
const BUILD_GRADLE = 'android/app/build.gradle';

/** The package names the Firebase file lists (and nothing else from it). */
export function packageNames(json) {
  const clients = JSON.parse(json).client;
  if (!Array.isArray(clients)) return [];
  return clients.map((c) => c?.client_info?.android_client_info?.package_name).filter((n) => typeof n === 'string');
}

/** The applicationId in build.gradle, or null. */
export function applicationId(gradle) {
  return /applicationId\s+["']([^"']+)["']/.exec(gradle)?.[1] ?? null;
}

/** Null when the app is listed, otherwise the message to show. */
export function packageProblem(names, appId) {
  if (names.includes(appId)) return null;
  return `google-services.json is for ${names.join(', ') || 'no Android app'}, but the APK is ${appId}: add ${appId} to the Firebase project and download the file again (docs/push-setup.md).`;
}

/** Fails only when the file exists and is for another app: push is optional. */
export function checkGoogleServices(read = readFileSync, exists = existsSync) {
  if (!exists(GOOGLE_SERVICES)) return { ok: true, message: 'check:google-services: no file, the APK is built without push.' };
  const appId = applicationId(read(BUILD_GRADLE, 'utf8'));
  let names;
  try {
    names = packageNames(read(GOOGLE_SERVICES, 'utf8'));
  } catch {
    return { ok: false, message: 'check:google-services: the file is not valid JSON.' };
  }
  const problem = packageProblem(names, appId);
  return problem
    ? { ok: false, message: `check:google-services: ${problem}` }
    : { ok: true, message: `check:google-services: ok, the file includes ${appId}.` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { ok, message } = checkGoogleServices();
  (ok ? process.stdout : process.stderr).write(`${message}\n`);
  process.exitCode = ok ? 0 : 1;
}
