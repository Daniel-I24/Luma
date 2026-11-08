/**
 * An option says OK only when the project confirms it. Regression of the round
 * in which luma.ps1 answered OK and production never changed: npx.ps1 re-reads
 * the text of its calling line, so "@args" never reached the CLI, which showed
 * its help and exited 0. Simulated services only (scripts/luma.harness.mjs).
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { FEATURES, FUNCTIONS } from './doctor/expected.mjs';
import { SUPABASE_CLI } from './doctor.mjs';
import { REF, here, runOption, skip, states } from './luma.harness.mjs';

const ACCOUNT = JSON.stringify({ type: 'service_account', project_id: 'luma-app', client_email: 'a@b.c', private_key: 'KEY' });
const WOMPI = 'pub_test_AAA prv_test_BBB test_events_CCC test_integrity_DDD';
const WEB = 'WEB_ORIGIN=https://luma.example\n';
const PROD = 'pub_prod_AAA\nprv_prod_BBB\nprod_events_CCC\nprod_integrity_DDD\n';
const line = (r, pattern) => r.lines.find((l) => pattern.test(l.item));

test('a CLI that answers 0 and changes nothing is FALTA, never OK', { skip }, () => {
  const push = runOption(`Invoke-LumaPush '${REF}'`, { files: { 'firebase-service-account.json': ACCOUNT }, applies: false });
  assert.equal(line(push, /Secreto FCM_SERVICE_ACCOUNT/).state, 'FALTA');
  assert.match(line(push, /Secreto FCM_SERVICE_ACCOUNT/).item, /NO EXISTE/);
  assert.equal(line(push, /Funcion push-dispatch/).state, 'FALTA');
  const routes = runOption(`Invoke-LumaRoutes '${REF}'`, { answers: ['k'], http: { openrouteservice: { status: 200 } }, applies: false });
  assert.equal(line(routes, /Secreto ROUTE_API_KEY/).state, 'FALTA');
  assert.equal(line(routes, /Funcion route/).state, 'FALTA');
});

test('what was already there with an old date is not today\'s work', { skip }, () => {
  const r = runOption(`Invoke-LumaRoutes '${REF}'`, {
    answers: ['k'], http: { openrouteservice: { status: 200 } }, applies: false,
    oldSecrets: ['ROUTE_API_KEY', 'ROUTE_PROVIDER'], oldFunctions: ['route'],
  });
  assert.match(line(r, /Secreto ROUTE_API_KEY/).item, /sigue con fecha/);
  assert.equal(line(r, /Secreto ROUTE_API_KEY/).state, 'FALTA');
  assert.match(line(r, /Funcion route/).item, /sigue con fecha/);
  assert.equal(line(r, /Funcion route/).state, 'FALTA');
});

test('confirmed today is OK, and a function the CLI found unchanged is OK with its old date', { skip }, () => {
  const fresh = runOption(`Invoke-LumaRoutes '${REF}'`, { answers: ['k'], http: { openrouteservice: { status: 200 } } });
  assert.equal(states(fresh).includes('FALTA'), false);
  assert.match(line(fresh, /Funcion route/).item, /desplegada/);
  const same = runOption(`Invoke-LumaRoutes '${REF}'`, { answers: ['k'], http: { openrouteservice: { status: 200 } }, oldFunctions: ['route'], unchanged: ['route'] });
  assert.equal(line(same, /Funcion route/).state, 'OK');
  assert.match(line(same, /Funcion route/).item, /sin cambios desde/);
});

test('a refused CLI stops the option: secrets refused deploy nothing, a failed deploy stops the rest', { skip }, () => {
  const refused = runOption(`Invoke-LumaPayments '${REF}'`, { files: { 'web.env': WEB, 'wompi-sandbox.txt': WOMPI }, cli: 1 });
  assert.equal(refused.calls.some((c) => c.startsWith('functions deploy')), false);
  assert.equal(refused.lines.at(-1).state, 'FALTA');
  assert.equal(refused.tempLeft, false, 'the temporary secrets file is removed when the CLI fails too');
  const stopped = runOption(`Invoke-LumaPayments '${REF}'`, { files: { 'web.env': WEB, 'wompi-sandbox.txt': WOMPI }, failDeploy: 'wompi-webhook' });
  assert.equal(stopped.calls.some((c) => c.startsWith('functions deploy reconcile-payments')), false);
  assert.match(stopped.lines.at(-1).item, /wompi-webhook, reconcile-payments, void-payment/);
  assert.equal(stopped.file('payments-settings.sql'), null, 'no SQL to paste when nothing is deployed');
});

test('a project that cannot be read is FALTA', { skip }, () => {
  const r = runOption(`Invoke-LumaRoutes '${REF}'`, { answers: ['k'], http: { openrouteservice: { status: 200 } }, unreadable: true });
  assert.ok(r.lines.some((l) => l.state === 'FALTA' && /No pude leer/.test(l.item)));
});

test('option 3 never loads production keys and says so; functions.env fills what the sandbox file lacks', { skip }, () => {
  const r = runOption(`Invoke-LumaPayments '${REF}'`, { files: { 'web.env': WEB, 'wompi-sandbox.txt': PROD } });
  assert.deepEqual(states(r), ['FALTA']);
  assert.match(r.lines[0].item, /PRODUCCION/);
  assert.equal(r.envFiles.length, 0);
  assert.equal(r.calls.some((c) => c.startsWith('functions deploy')), false);
  for (const key of PROD.trim().split('\n')) assert.equal(`${r.stdout}${JSON.stringify(r.lines)}`.includes(key), false);

  const mixed = runOption(`Invoke-LumaPayments '${REF}'`, {
    files: { 'web.env': WEB, 'wompi-sandbox.txt': 'pub_test_AAA prv_test_BBB', 'functions.env': `X=prv_prod_ZZZ\nA=test_events_CCC\nB=test_integrity_DDD\n` },
  });
  assert.match(mixed.envFiles[0], /WOMPI_PRIVATE_KEY='prv_test_BBB'/);
  assert.match(mixed.envFiles[0], /WOMPI_EVENTS_SECRET='test_events_CCC'/);
  assert.equal(mixed.envFiles[0].includes('prv_prod_ZZZ'), false);
  assert.equal(states(mixed).includes('FALTA'), false);
});

test('option 3 without the web domain says where to write it and loads nothing', { skip }, () => {
  const r = runOption(`Invoke-LumaPayments '${REF}'`, { files: { 'wompi-sandbox.txt': WOMPI } });
  assert.deepEqual(states(r), ['FALTA']);
  assert.match(r.lines[0].next, /WEB_ORIGIN=https/);
  assert.equal(r.envFiles.length, 0);
  const bad = runOption(`Invoke-LumaPayments '${REF}'`, { files: { 'wompi-sandbox.txt': WOMPI, 'web.env': 'WEB_ORIGIN=luma://x\n' } });
  assert.deepEqual(states(bad), ['FALTA']);
});

test('option 8: every service without questions, each function once, one final table from the project', { skip }, () => {
  const r = runOption(`Invoke-LumaAll '${REF}'`, {
    files: {
      'ai.env': 'LLM_API_KEY=k\nLLM_MODEL=gemini-3.6-flash\nLLM_FALLBACK_MODEL=gemini-3.5-flash-lite\n',
      'firebase-service-account.json': ACCOUNT, 'web.env': WEB, 'wompi-sandbox.txt': WOMPI, 'routes.env': 'ROUTE_API_KEY=r\n',
      'whatsapp.env': 'WHATSAPP_VERIFY_TOKEN=t\nWHATSAPP_APP_SECRET=s\nWHATSAPP_PHONE_NUMBER_ID=1\n',
    },
    http: { generateContent: { status: 200 }, openrouteservice: { status: 200 }, 'whatsapp-webhook': { status: 200, body: 'ECHO' } },
    oldSecrets: ['GEOCODE_PROVIDER', 'GEOCODE_API_KEY'],
    workFiles: { 'android/app/google-services.json': '{}' },
  });
  for (const name of FUNCTIONS) {
    assert.equal(r.calls.filter((c) => c === `functions deploy ${name} --use-api --remote=${REF} --yes`).length, 1, name);
    assert.equal(line(r, new RegExp(`Funcion ${name} `)).state, 'OK', name);
  }
  const needed = Object.values(FEATURES).flatMap((f) => f.secrets);
  for (const name of needed) assert.equal(line(r, new RegExp(`Secreto ${name} `)).state, 'OK', name);
  assert.match(line(r, /Secreto GEOCODE_API_KEY/).item, /existe/, 'not loaded here: only has to exist');
  assert.match(r.envFiles.join(), /PAYMENT_RETURN_URL='https:\/\/luma\.example\/pago-listo\.html'/);
  assert.match(r.envFiles.join(), /ALLOWED_ORIGINS='https:\/\/luma\.example,https:\/\/localhost,http:\/\/localhost:4200'/);
  assert.equal(r.lines.filter((l) => l.state === 'TABLA').length, 1);
  assert.equal(r.lines.filter((l) => /Funcion route /.test(l.item)).length, 1, 'one table, not one per option');
  assert.equal(states(r).includes('FALTA'), false);
});

test('option 8 goes on when a service cannot run, and the table shows what is missing', { skip }, () => {
  const r = runOption(`Invoke-LumaAll '${REF}'`, { files: { 'web.env': WEB, 'firebase-service-account.json': ACCOUNT, 'wompi-sandbox.txt': PROD } });
  assert.ok(r.calls.includes(`functions deploy push-dispatch --use-api --remote=${REF} --yes`), 'push still runs');
  assert.ok(r.calls.includes(`functions deploy delete-account --use-api --remote=${REF} --yes`), 'and the plain functions');
  assert.ok(r.lines.some((l) => l.state === 'FALTA' && /PRODUCCION/.test(l.item)));
  assert.match(line(r, /Secreto WOMPI_PRIVATE_KEY/).item, /NO EXISTE/);
  assert.equal(line(r, /Secreto FCM_SERVICE_ACCOUNT/).state, 'OK');
});

test('option 6: a build that leaves no new APK is FALTA and nothing is installed', { skip }, () => {
  const r = runOption('Invoke-LumaApk', { files: { 'app.env': 'SUPABASE_URL=https://x.supabase.co\nSUPABASE_ANON_KEY=a\n' }, phones: ['AAA'], apkFresh: false });
  assert.ok(r.lines.some((l) => l.state === 'FALTA' && /no dejo un archivo nuevo/.test(l.item)));
  assert.equal(r.calls.some((c) => c.startsWith('adb')), false);
});

test('no PowerShell file calls npx or npm through their .ps1 wrappers', () => {
  for (const file of ['luma.ps1', 'setup-push.ps1', ...readdirSync(join(here, 'luma')).map((f) => `luma/${f}`)]) {
    const code = readFileSync(join(here, file), 'utf8').split(/\r?\n/).filter((l) => !l.trim().startsWith('#')).join('\n');
    assert.equal(/&\s*(npx|npm)\s/.test(code), false, file);
  }
});

test('luma.ps1 and the doctor use one CLI version, and every option is in the menu', () => {
  assert.ok(readFileSync(join(here, 'luma', 'remote.ps1'), 'utf8').includes(`'${SUPABASE_CLI}'`));
  const menu = readFileSync(join(here, 'luma.ps1'), 'utf8');
  for (const key of ['1', '2', '3', '4', '5', '6', '7', '8']) assert.match(menu, new RegExp(`'${key}' = @\\(`));
  assert.match(menu, /Invoke-LumaAll \(Get-LumaTarget\)/);
});
