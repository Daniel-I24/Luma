import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { createContext, format, parseEnvFile, runDoctor } from './doctor.mjs';
import { FUNCTIONS } from './doctor/expected.mjs';

const REF = 'abcdefghijklmnopqrst';
const KEY = 'AIza-secret-key';
const TOKEN = 'sbp_secret_token';

/** A project folder, a secrets folder and simulated Supabase, Gemini and WhatsApp services. */
function setup({ secrets = [], functions = FUNCTIONS, applied = ['20261105000000'], challenge = 'echo', gemini = 200, files = {}, token = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'doctor-root-'));
  const dir = mkdtempSync(join(tmpdir(), 'doctor-secrets-'));
  mkdirSync(join(root, 'supabase', 'migrations'), { recursive: true });
  for (const name of ['20261105000000_round8.sql', '20261106000000_round9.sql']) writeFileSync(join(root, 'supabase', 'migrations', name), '');
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
    if (url.endsWith('/database/migrations')) return json(applied.map((version) => ({ version })));
    if (url.endsWith('/database/query')) return json([{ key: 'payments_enabled', int_value: 0 }, { key: 'show_pending_businesses', int_value: 1 }]);
    if (url.includes('/whatsapp-webhook?')) {
      const sent = new URL(url).searchParams.get('hub.challenge');
      return challenge === 'echo' ? new Response(sent) : new Response('Forbidden', { status: 403 });
    }
    if (url.includes('generativelanguage')) return json({}, gemini);
    return json({}, 404);
  };
  // The Supabase CLI with the user's own session (no token of theirs in the doctor).
  const cli = (args) => {
    calls.push({ url: `cli ${args.join(' ')}`, init: {} });
    if (args[0] === 'secrets') return secrets.map((name) => ({ name, value: 'digest' }));
    if (args[0] === 'functions') return functions.map((slug) => ({ slug, status: 'ACTIVE' }));
    throw new Error('unexpected CLI call');
  };
  const env = { SUPABASE_PROJECT_REF: REF, LUMA_SECRETS_DIR: dir, ...(token ? { SUPABASE_ACCESS_TOKEN: TOKEN } : {}) };
  return { ctx: createContext({ env, root, fetchFn, random: () => 0.5, cli }), calls };
}

const find = (lines, text) => lines.find((l) => l.item.includes(text));

test('pending migrations, flags and features without configuration are reported in Spanish', async () => {
  const { ctx } = setup();
  const lines = await runDoctor(ctx);
  assert.equal(find(lines, 'Migraciones sin aplicar').item, 'Migraciones sin aplicar: 20261106000000');
  assert.match(find(lines, 'Migraciones sin aplicar').next, /npx supabase db push --remote/);
  assert.match(find(lines, 'Migraciones sin aplicar').next, /No las pegues en el SQL Editor/);
  assert.equal(find(lines, 'payments_enabled').item, 'Bandera payments_enabled = 0');
  assert.equal(find(lines, 'payments_production').state, 'FALTA');
  assert.equal(find(lines, 'Luma IA').state, 'APAGADO');
  assert.match(find(lines, 'Luma IA').next, /opción 1/);
  assert.equal(find(lines, 'Reto del webhook').state, 'APAGADO');
  assert.match(format(lines), /Faltan \d+ cosas/);
});

test('a feature with some secrets or functions missing says exactly what', async () => {
  const { ctx } = setup({ secrets: ['LLM_PROVIDER', 'LLM_MODEL'], functions: FUNCTIONS.filter((f) => f !== 'recommend') });
  const line = find(await runDoctor(ctx), 'Luma IA');
  assert.equal(line.state, 'FALTA');
  assert.equal(line.item, 'Luma IA: falta secreto LLM_API_KEY, función recommend');
});

test('the WhatsApp challenge and the Gemini key are tested against the services, never printed', async () => {
  const files = {
    'whatsapp.env': 'WHATSAPP_VERIFY_TOKEN=frase-secreta\n',
    'ai.env': `LLM_API_KEY='${KEY}'\nLLM_MODEL=gemini-3.8-flash\nLLM_FALLBACK_MODEL=gemini-3.1-flash-lite\n`,
  };
  const { ctx, calls } = setup({ files });
  const lines = await runDoctor(ctx);
  assert.equal(find(lines, 'Reto del webhook').state, 'OK');
  assert.equal(find(lines, 'modelo gemini-3.8-flash').state, 'OK');
  assert.equal(find(lines, 'respaldo gemini-3.1-flash-lite').state, 'OK');
  const gemini = calls.find((c) => c.url.includes('generativelanguage'));
  assert.equal(gemini.init.headers['x-goog-api-key'], KEY);
  assert.equal(gemini.url.includes(KEY), false, 'the key travels in a header, not in the URL');
  const output = format(lines);
  for (const secret of [KEY, TOKEN, 'frase-secreta']) assert.equal(output.includes(secret), false);
});

test('a refused key, a missing model and a wrong WhatsApp token are FALTA with the next step', async () => {
  const files = { 'whatsapp.env': 'WHATSAPP_VERIFY_TOKEN=otra\n', 'ai.env': `LLM_API_KEY=${KEY}\nLLM_MODEL=m\n` };
  const refused = await runDoctor(setup({ files, challenge: 'refuse', gemini: 403 }).ctx);
  assert.equal(find(refused, 'Reto del webhook').state, 'FALTA');
  assert.match(find(refused, 'clave fue rechazada').next, /AI Studio/);
  const unknown = await runDoctor(setup({ files, gemini: 404 }).ctx);
  assert.equal(find(unknown, 'no existe').state, 'FALTA');
});

test('a failing CLI (no "npx supabase login") is one FALTA line, not a crash', async () => {
  const { ctx } = setup();
  const broken = { ...ctx, cli: () => { throw new Error('"npx supabase secrets list" falló: ¿hiciste "npx supabase login"?'); } };
  const lines = await runDoctor(broken);
  assert.ok(lines.some((l) => l.item.startsWith('No pude comprobar Features: "npx supabase secrets list" falló')));
});

test('without a token: secrets and functions from the CLI session; migrations and flags are APAGADO', async () => {
  const { ctx, calls } = setup({ token: false, secrets: ['LLM_PROVIDER', 'LLM_MODEL', 'LLM_API_KEY'] });
  const lines = await runDoctor(ctx);
  assert.equal(find(lines, 'Migraciones').state, 'APAGADO');
  assert.equal(find(lines, 'Banderas').state, 'APAGADO');
  assert.match(find(lines, 'Migraciones').next, /solo en memoria, no se guarda/);
  assert.equal(find(lines, 'Luma IA').state, 'OK');
  assert.equal(calls.some((c) => c.url.startsWith('https://api.supabase.com')), false, 'no Management API call without a token');
  assert.ok(calls.some((c) => c.url === `cli secrets list --remote=${REF}`));
});

test('the doctor never reads a token from a file, and without a project says how to link it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'doctor-secrets-'));
  writeFileSync(join(dir, 'supabase-access-token.txt'), 'sbp_on_disk');
  const root = mkdtempSync(join(tmpdir(), 'doctor-root-'));
  mkdirSync(join(root, 'supabase', 'migrations'), { recursive: true });
  const ctx = createContext({ env: { SUPABASE_PROJECT_REF: REF, LUMA_SECRETS_DIR: dir }, root, cli: () => [] });
  assert.equal(ctx.api, null);
  assert.throws(() => createContext({ env: { LUMA_SECRETS_DIR: tmpdir() }, root: tmpdir() }), /npx supabase link/);
});

test('env files: quotes, comments and Windows line endings', () => {
  assert.deepEqual(parseEnvFile("# nota\r\nA='uno'\r\nB=\"dos\"\nC = tres \n"), { A: 'uno', B: 'dos', C: 'tres' });
});
