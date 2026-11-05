import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GOOGLE_SERVICES, applicationId, checkGoogleServices, packageNames, packageProblem } from './check-google-services.mjs';

const SECRET = 'NOT_TO_BE_PRINTED';
const file = (name) =>
  JSON.stringify({
    project_info: { project_number: SECRET },
    client: [{ client_info: { android_client_info: { package_name: name } }, api_key: [{ current_key: SECRET }] }],
  });
const gradle = 'defaultConfig {\n  applicationId "com.lumapasto.app"\n}';
const read = (json) => (path) => (path === GOOGLE_SERVICES ? json : gradle);

test('reads only the package names and the applicationId', () => {
  assert.deepEqual(packageNames(file('com.lumapasto.app')), ['com.lumapasto.app']);
  assert.deepEqual(packageNames('{}'), []);
  assert.equal(applicationId(gradle), 'com.lumapasto.app');
});

test('a file for this app passes; another app is explained', () => {
  assert.equal(packageProblem(['com.lumapasto.app', 'other'], 'com.lumapasto.app'), null);
  assert.match(packageProblem(['com.other'], 'com.lumapasto.app'), /is for com\.other, but the APK is com\.lumapasto\.app/);
});

test('fails on another app or a broken file and never prints the rest of the file', () => {
  const wrong = checkGoogleServices(read(file('com.other')), () => true);
  assert.equal(wrong.ok, false);
  assert.ok(!wrong.message.includes(SECRET));
  assert.equal(checkGoogleServices(read('not json'), () => true).ok, false);
  const right = checkGoogleServices(read(file('com.lumapasto.app')), () => true);
  assert.equal(right.ok, true);
  assert.ok(!right.message.includes(SECRET));
});

test('without the file there is nothing to check: push is optional', () => {
  assert.equal(checkGoogleServices(read(''), () => false).ok, true);
});
