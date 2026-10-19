import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';

import { ApkError, checkSigning, jdkCandidates, jdkMajor, resolveJavaHome } from './apk.mjs';

const env = { ProgramFiles: 'C:\\Program Files', LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' };
const jbr = join('C:\\Program Files', 'Android', 'Android Studio', 'jbr');
const adoptium = join('C:\\Program Files', 'Eclipse Adoptium', 'jdk-21');

/** A fake disk with JDK homes of the given major versions. */
function disk(jdks) {
  const java = (dir) => join(dir, 'bin', 'java.exe');
  return {
    exists: (path) => Object.keys(jdks).some((dir) => java(dir) === path),
    read: (path) => {
      const dir = Object.keys(jdks).find((home) => join(home, 'release') === path);
      return dir ? `JAVA_VERSION="${jdks[dir]}.0.1"\n` : null;
    },
    list: (dir) =>
      dir === join('C:\\Program Files', 'Eclipse Adoptium') && jdks[adoptium] ? ['jdk-21'] : [],
  };
}

test('reads the JDK major version from its release file', () => {
  const fake = disk({ 'C:\\jdk': 21 });
  assert.equal(jdkMajor('C:\\jdk', 'win32', fake.exists, fake.read), 21);
  assert.equal(jdkMajor('C:\\nothing', 'win32', fake.exists, fake.read), null);
});

test('keeps a valid JAVA_HOME', () => {
  assert.equal(
    resolveJavaHome({ ...env, JAVA_HOME: 'C:\\jdk' }, 'win32', disk({ 'C:\\jdk': 17 })),
    'C:\\jdk',
  );
});

test('replaces an invalid JAVA_HOME with the Android Studio JBR', () => {
  const resolved = resolveJavaHome({ ...env, JAVA_HOME: 'C:\\gone' }, 'win32', disk({ [jbr]: 21 }));
  assert.equal(resolved, jbr);
});

test('skips a JBR newer than Gradle supports and uses another installed JDK', () => {
  const resolved = resolveJavaHome(env, 'win32', disk({ [jbr]: 25, [adoptium]: 21 }));
  assert.equal(resolved, adoptium);
  assert.ok(jdkCandidates('darwin', {})[0].includes('Android Studio.app'));
});

test('fails clearly when no compatible JDK exists', () => {
  assert.throws(() => resolveJavaHome(env, 'win32', disk({ [jbr]: 25 })), ApkError);
});

test('release signing needs the four variables and an existing keystore, never echoing them', () => {
  const vars = {
    LUMA_KEYSTORE_PATH: 'C:\\keys\\luma.jks',
    LUMA_KEYSTORE_PASSWORD: 'secret-pass',
    LUMA_KEY_ALIAS: 'luma',
    LUMA_KEY_PASSWORD: 'secret-key',
  };
  const exists = (path) => path === 'C:\\keys\\luma.jks';
  assert.doesNotThrow(() => checkSigning(vars, exists));
  assert.throws(() => checkSigning(vars, () => false), /does not point to a file/);
  assert.throws(
    () => checkSigning({ ...vars, LUMA_KEY_PASSWORD: ' ' }, exists),
    (error) => /LUMA_KEY_PASSWORD/.test(error.message) && !/secret/.test(error.message),
  );
});
