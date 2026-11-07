import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  EnvError,
  ensureBaseEnvironment,
  jwtRole,
  readSupabaseEnv,
  renderEnvironment,
  TARGET_PATH,
} from './generate-env.mjs';

const jwt = (payload) =>
  ['{"alg":"HS256"}', JSON.stringify(payload)]
    .map((part) => Buffer.from(part).toString('base64url'))
    .concat('signature')
    .join('.');

const URL_OK = 'https://abcd.supabase.co';

test('accepts an anon JWT or a publishable key', () => {
  const anon = jwt({ role: 'anon' });
  assert.deepEqual(readSupabaseEnv({ SUPABASE_URL: URL_OK, SUPABASE_ANON_KEY: anon }), {
    url: URL_OK,
    anonKey: anon,
  });
  assert.equal(
    readSupabaseEnv({ SUPABASE_URL: `${URL_OK}/`, SUPABASE_ANON_KEY: 'sb_publishable_x' }).url,
    URL_OK,
  );
});

test('fails when a variable is missing or empty', () => {
  assert.throws(() => readSupabaseEnv({ SUPABASE_URL: URL_OK }), EnvError);
  assert.throws(() => readSupabaseEnv({ SUPABASE_URL: ' ', SUPABASE_ANON_KEY: 'k' }), EnvError);
});

test('rejects privileged keys: sb_secret_ and service_role JWTs', () => {
  assert.throws(
    () => readSupabaseEnv({ SUPABASE_URL: URL_OK, SUPABASE_ANON_KEY: 'sb_secret_abc' }),
    /secret key/,
  );
  assert.throws(
    () =>
      readSupabaseEnv({ SUPABASE_URL: URL_OK, SUPABASE_ANON_KEY: jwt({ role: 'service_role' }) }),
    /service_role/,
  );
});

test('rejects URLs that are invalid or not https', () => {
  assert.throws(
    () => readSupabaseEnv({ SUPABASE_URL: 'nope', SUPABASE_ANON_KEY: 'k' }),
    /valid URL/,
  );
  assert.throws(
    () => readSupabaseEnv({ SUPABASE_URL: 'http://abcd.supabase.co', SUPABASE_ANON_KEY: 'k' }),
    /https/,
  );
});

test('a clean clone gets environment.ts from the example; an existing one is never touched', () => {
  const dir = mkdtempSync(join(tmpdir(), 'luma-env-'));
  writeFileSync(join(dir, 'environment.example.ts'), 'example');
  assert.equal(ensureBaseEnvironment(dir), true);
  assert.equal(readFileSync(join(dir, 'environment.ts'), 'utf8'), 'example');

  writeFileSync(join(dir, 'environment.ts'), 'my real keys');
  assert.equal(ensureBaseEnvironment(dir), false);
  assert.equal(readFileSync(join(dir, 'environment.ts'), 'utf8'), 'my real keys');
});

test('without the example it fails instead of building something else', () => {
  const dir = mkdtempSync(join(tmpdir(), 'luma-env-'));
  assert.throws(() => ensureBaseEnvironment(dir), /ENOENT/);
  assert.equal(existsSync(join(dir, 'environment.ts')), false);
});

test('CI builds from scratch, without environment.ts, and checks what Vercel serves', () => {
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const job = ci.slice(ci.indexOf('  clean-build:'), ci.indexOf('  secrets:'));
  assert.ok(job.includes('npm run build:prod'));
  assert.equal(job.includes('environment.example.ts src/environments/environment.ts'), false, 'it must not prepare the file');
  for (const file of ['pago-listo.html', 'pago-listo.js', 'legal/terminos.html', 'legal/privacidad.html']) assert.ok(job.includes(file), file);
});

test('reads the role claim only from well-formed JWTs', () => {
  assert.equal(jwtRole(jwt({ role: 'anon' })), 'anon');
  assert.equal(jwtRole('a.b'), null);
  assert.equal(jwtRole('a.%%%.c'), null);
});

test('renders a typed production environment with escaped values', () => {
  const source = renderEnvironment({ url: URL_OK, anonKey: 'k"ey' });
  assert.match(source, /production: true/);
  assert.match(source, /url: "https:\/\/abcd\.supabase\.co"/);
  assert.match(source, /anonKey: "k\\"ey"/);
  assert.match(source, /as const;/);
});

test('writes the gitignored deploy environment, never the committed prod one', () => {
  assert.equal(TARGET_PATH, 'src/environments/environment.deploy.ts');
  const ignored = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8').split(/\r?\n/);
  assert.ok(ignored.includes(TARGET_PATH), '.gitignore must list the generated file');
});

test('the deploy configuration swaps environment.ts for the generated file', () => {
  const angular = JSON.parse(readFileSync(new URL('../angular.json', import.meta.url), 'utf8'));
  const deploy = angular.projects.luma.architect.build.configurations.deploy;
  assert.deepEqual(deploy.fileReplacements, [
    { replace: 'src/environments/environment.ts', with: TARGET_PATH },
  ]);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(
    pkg.scripts['build:prod'],
    /generate-env\.mjs && node scripts\/build-legal\.mjs && node scripts\/build-flags\.mjs ng build --configuration production,deploy$/,
  );
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(vercel.buildCommand, 'npm run build:prod');
});
