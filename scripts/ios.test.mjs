import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { steps } from './ios.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const plist = read('ios/App/App/Info.plist');
const delegate = read('ios/App/App/AppDelegate.swift');

test('iOS build: web, then sync; push follows the Firebase file of iOS', () => {
  const env = { PUSH_ENABLED: '1' };
  const [generate, build, sync] = steps(env, true);
  assert.deepEqual(generate[1], ['scripts/generate-env.mjs']);
  assert.ok(build[1].includes("LUMA_PUSH_ENABLED='true'"));
  assert.deepEqual(sync[1], ['cap', 'sync', 'ios']);
  assert.ok(steps({}, false)[1][1].includes("LUMA_PUSH_ENABLED='false'"));
  assert.throws(() => steps(env, false), /PUSH_ENABLED=1/);
});

test('Info.plist explains every permission in Spanish', () => {
  for (const key of ['NSLocationWhenInUseUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSCameraUsageDescription']) {
    assert.match(plist, new RegExp(`<key>${key}</key>\\s*<string>[^<]{20,}</string>`), key);
  }
  assert.doesNotMatch(plist, /NSLocationAlways/, 'only while the app is in use');
});

test('Wompi returns through luma://, and notifications can arrive', () => {
  assert.match(plist, /<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>luma<\/string>/);
  assert.match(plist, /<key>UIBackgroundModes<\/key>\s*<array>\s*<string>remote-notification<\/string>/);
});

test('the app delegate hands the plugin the FCM token, and compiles without Firebase', () => {
  assert.match(delegate, /#if canImport\(FirebaseMessaging\)/);
  assert.match(delegate, /Messaging\.messaging\(\)\.apnsToken = deviceToken/);
  assert.match(delegate, /capacitorDidRegisterForRemoteNotifications, object: token/);
  assert.match(delegate, /capacitorDidFailToRegisterForRemoteNotifications/);
});
