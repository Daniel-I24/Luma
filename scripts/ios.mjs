#!/usr/bin/env node
/**
 * Prepares the iOS project on a Mac (`npm run ios:sync`, docs/ios.md): the production web
 * build with the variables of the environment, then `cap sync ios`. Push follows
 * ios/App/App/GoogleService-Info.plist, as the APK follows google-services.json.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineArgs } from './build-flags.mjs';

export const IOS_FIREBASE = 'ios/App/App/GoogleService-Info.plist';

/** The commands, in order. */
export function steps(env, hasFirebase) {
  return [
    ['node', ['scripts/generate-env.mjs']],
    ['npx', ['ng', 'build', '--configuration', 'production,deploy', ...defineArgs(env, hasFirebase)]],
    ['npx', ['cap', 'sync', 'ios']],
  ];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [command, args] of steps(process.env, existsSync(IOS_FIREBASE))) {
    const run = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    if (run.status !== 0) process.exit(run.status ?? 1);
  }
}
