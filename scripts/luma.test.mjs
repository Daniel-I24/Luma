import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { REF, here, runOption, skip, states } from './luma.harness.mjs';

test('every PowerShell file is ASCII (PowerShell 5.1 reads them as ANSI) with short lines', { skip: false }, () => {
  for (const file of ['luma.ps1', 'setup-push.ps1', ...readdirSync(join(here, 'luma')).map((f) => `luma/${f}`)]) {
    const text = readFileSync(join(here, file), 'utf8');
    assert.equal(/[^\x00-\x7f]/.test(text), false, file);
    assert.equal(text.split(/\r?\n/).length <= 150, true, file);
    assert.equal(/ivan2|C:\\Users\\/.test(text), false, `${file}: no personal path`);
  }
});

test('option 3: Wompi keys found by their prefix in any order, secrets loaded, 4 functions deployed, SQL written', { skip }, () => {
  const text = 'Llave privada: prv_test_BBB\nEventos test_events_CCC y pub_test_AAA\nIntegridad: test_integrity_DDD\n';
  const r = runOption(`Invoke-LumaPayments '${REF}'`, { files: { 'wompi-sandbox.txt': text } });
  assert.match(r.envFiles[0], /WOMPI_PUBLIC_KEY='pub_test_AAA'/);
  assert.match(r.envFiles[0], /WOMPI_PRIVATE_KEY='prv_test_BBB'/);
  assert.match(r.envFiles[0], /WOMPI_EVENTS_SECRET='test_events_CCC'/);
  assert.match(r.envFiles[0], /WOMPI_INTEGRITY_SECRET='test_integrity_DDD'/);
  assert.match(r.envFiles[0], /WOMPI_ENV='test'/);
  const cron = /PAYMENTS_CRON_SECRET='([0-9a-f]{64})'/.exec(r.envFiles[0])[1];
  assert.equal(r.tempLeft, false, 'the temporary secrets file is removed');
  for (const name of ['create-payment', 'wompi-webhook', 'reconcile-payments', 'void-payment']) {
    assert.ok(r.calls.includes(`functions deploy ${name} --use-api --project-ref ${REF}`), name);
  }
  assert.match(r.file('payments-settings.sql'), new RegExp(`'${cron}'`));
  assert.ok(r.lines.some((l) => l.state === 'APAGADO' && /wompi-webhook/.test(l.next)), 'reminds the events URL');
  for (const secret of ['prv_test_BBB', 'test_events_CCC', 'test_integrity_DDD', cron]) assert.equal(r.stdout.includes(secret), false);

  const again = runOption(`Invoke-LumaPayments '${REF}'`, { files: { 'wompi-sandbox.txt': text, 'payments-settings.sql': r.file('payments-settings.sql') } });
  assert.match(again.envFiles[0], new RegExp(`PAYMENTS_CRON_SECRET='${cron}'`), 'repeating keeps the cron secret already pasted');
});

test('option 3 without all the keys says which prefix is missing and loads nothing', { skip }, () => {
  const r = runOption(`Invoke-LumaPayments '${REF}'`, { files: { 'wompi-sandbox.txt': 'pub_test_A prv_test_B' } });
  assert.deepEqual(states(r), ['FALTA']);
  assert.match(r.lines[0].item, /test_events_\.\.\., test_integrity_\.\.\./);
  assert.equal(r.calls.filter((c) => !c.startsWith('after ')).length, 0);
});

test('option 1: Gemini key and models tested, LLM_* loaded, the three AI functions deployed', { skip }, () => {
  const r = runOption(`Invoke-LumaAi '${REF}'`, {
    answers: ['AIza-clave', '', ''],
    http: { 'models/gemini-3.6-flash:generateContent': { status: 200 }, 'models/gemini-3.5-flash-lite:generateContent': { status: 200 } },
  });
  assert.match(r.envFiles[0], /LLM_PROVIDER='gemini'/);
  assert.match(r.envFiles[0], /LLM_FALLBACK_MODEL='gemini-3.5-flash-lite'/);
  assert.ok(r.calls.includes('HTTP https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent'), 'a real generateContent call');
  for (const name of ['recommend', 'suggest-promotions', 'extract-menu']) assert.ok(r.calls.includes(`functions deploy ${name} --use-api --project-ref ${REF}`));
  assert.equal(r.calls.some((c) => c.startsWith('HTTP') && c.includes('AIza-clave')), false, 'the key goes in a header');
  assert.match(r.file('ai.env'), /LLM_API_KEY=AIza-clave/);
  assert.equal(r.stdout.includes('AIza-clave'), false);
  assert.equal(states(r).includes('FALTA'), false);
});

test('option 1 reports a model that does not exist and a refused key', { skip }, () => {
  const r = runOption(`Invoke-LumaAi '${REF}'`, { answers: ['k', 'gemini-x', '-'], http: { 'models/gemini-x': { status: 404 } } });
  assert.ok(r.lines.some((l) => l.state === 'FALTA' && /gemini-x no existe/.test(l.item)));
  assert.ok(r.lines.some((l) => l.state === 'APAGADO' && /respaldo/.test(l.item)));
});

test('option 1: a saturated model (503) or no quota now (429) is APAGADO, the fallback covers it', { skip }, () => {
  const r = runOption(`Invoke-LumaAi '${REF}'`, {
    answers: ['k', '', ''],
    http: { 'models/gemini-3.6-flash:generateContent': { status: 503 }, 'models/gemini-3.5-flash-lite:generateContent': { status: 429 } },
  });
  assert.ok(r.lines.some((l) => l.state === 'APAGADO' && /saturado ahora, el respaldo lo cubrira/.test(l.item)));
  assert.ok(r.lines.some((l) => l.state === 'APAGADO' && /respaldo gemini-3.5-flash-lite esta saturado/.test(l.item)));
  assert.equal(states(r).includes('FALTA'), false);
});

test('option 2: push secrets, push-dispatch with --use-api and the SQL, keeping the secret on a repeat', { skip }, () => {
  const account = JSON.stringify({ type: 'service_account', project_id: 'luma-app', client_email: 'a@b.c', private_key: 'KEY' });
  const r = runOption(`Invoke-LumaPush '${REF}'`, { files: { 'firebase-service-account.json': account } });
  assert.match(r.envFiles[0], /FCM_SERVICE_ACCOUNT='\{.*"project_id":"luma-app".*\}'/);
  assert.ok(r.calls.includes(`functions deploy push-dispatch --use-api --project-ref ${REF}`));
  const secret = /PUSH_DISPATCH_SECRET='([0-9a-f]{64})'/.exec(r.envFiles[0])[1];
  assert.match(r.file('push-settings.sql'), new RegExp(secret));
  const again = runOption(`Invoke-LumaPush '${REF}'`, { files: { 'firebase-service-account.json': account, 'push-settings.sql': r.file('push-settings.sql') } });
  assert.match(again.envFiles[0], new RegExp(`PUSH_DISPATCH_SECRET='${secret}'`));
  assert.equal(r.stdout.includes(secret), false);
});

test('option 2 without the Firebase file says where to put it', { skip }, () => {
  const r = runOption(`Invoke-LumaPush '${REF}'`);
  assert.deepEqual(states(r), ['FALTA']);
  assert.match(r.lines[0].next, /luma-secrets/);
});

test('options 4 and 5: the route key and the WhatsApp challenge are tested', { skip }, () => {
  const routes = runOption(`Invoke-LumaRoutes '${REF}'`, { answers: ['ors-key'], http: { openrouteservice: { status: 200 } } });
  assert.ok(routes.calls.includes(`functions deploy route --use-api --project-ref ${REF}`));
  assert.equal(states(routes).includes('FALTA'), false);
  const env = 'WHATSAPP_APP_SECRET=s\nWHATSAPP_PHONE_NUMBER_ID=123\n';
  const wa = runOption(`Invoke-LumaWhatsapp '${REF}'`, { files: { 'whatsapp.env': env }, http: { 'whatsapp-webhook': { status: 200, body: 'ECHO' } } });
  assert.match(wa.file('whatsapp.env'), /WHATSAPP_VERIFY_TOKEN=[0-9a-f]{64}/, 'a missing verify token is generated and saved');
  assert.ok(wa.lines.some((l) => l.state === 'OK' && /reto de Meta/.test(l.item)));
});

test('option 6: app.env reaches the build, and with two phones it asks which', { skip }, () => {
  const app = 'SUPABASE_URL=https://x.supabase.co\nSUPABASE_ANON_KEY=anon\nAI_MODE=remote\n';
  const r = runOption('Invoke-LumaApk', { files: { 'app.env': app }, phones: ['AAA', 'BBB'], answers: ['2'] });
  assert.ok(r.calls.includes('npm apk:debug AI_MODE=remote TOKEN='), 'without signing variables: a debug APK');
  assert.ok(r.calls.includes('adb -s BBB install -r android\\app\\build\\outputs\\apk\\debug\\app-debug.apk'));
  const none = runOption('Invoke-LumaApk', { files: { 'app.env': app } });
  assert.ok(none.lines.some((l) => l.state === 'FALTA' && /telefono conectado/.test(l.item)));
  const waiting = runOption('Invoke-LumaApk', { files: { 'app.env': app }, phones: ['CCC unauthorized'] });
  assert.ok(waiting.lines.some((l) => l.state === 'FALTA' && /no autorizo/.test(l.item) && /Permitir depuracion USB/.test(l.next)));
});

test('option 6 without app.env creates it: the anon key asked, AI_MODE and PUSH_ENABLED from what exists', { skip }, () => {
  const r = runOption(`& { $env:SUPABASE_PROJECT_REF = '${REF}'; Invoke-LumaApk }`, {
    files: { 'ai.env': 'LLM_API_KEY=k\n', 'google-services.json': '{}' }, answers: ['anon-public-key'], phones: ['AAA'],
  });
  const app = r.file('app.env');
  assert.match(app, /SUPABASE_URL=https:\/\/abcdefghijklmnopqrst\.supabase\.co/);
  assert.match(app, /SUPABASE_ANON_KEY=anon-public-key/);
  assert.match(app, /AI_MODE=remote/);
  assert.match(app, /PUSH_ENABLED=1/);
  assert.ok(r.lines.some((l) => l.state === 'OK' && /app.env creado/.test(l.item)));
});

test('option 7: the token lives only in the doctor process, is never written, and can be revoked', { skip }, () => {
  const r = runOption('Invoke-LumaDoctor', { answers: ['sbp_secret_token'] });
  assert.ok(r.calls.includes('npm doctor AI_MODE= TOKEN=sbp_secret_token'), 'the doctor gets it through its environment');
  assert.ok(r.calls.includes('after TOKEN='), 'and it is gone from the window afterwards');
  for (const name of readdirSync(r.dir)) assert.equal(readFileSync(join(r.dir, name), 'utf8').includes('sbp_secret_token'), false, name);
  assert.equal(readdirSync(r.dir).length, 0, 'nothing written to luma-secrets');
  assert.ok(r.lines.some((l) => /revocalo/.test(l.next)));
  assert.equal(r.stdout.includes('sbp_secret_token'), false);
  const without = runOption('Invoke-LumaDoctor', { answers: [''] });
  assert.ok(without.calls.includes('npm doctor AI_MODE= TOKEN='));
  assert.equal(without.lines.some((l) => /revocalo/.test(l.next)), false);
});

