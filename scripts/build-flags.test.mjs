import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { aiMode, contactEmail, defineArgs, FlagError, pushEnabled, supportWhatsapp } from './build-flags.mjs';

test('AI_MODE reaches the build as LUMA_AI_MODE; rules when unset; an unknown value fails', () => {
  assert.equal(aiMode({}), 'rules');
  assert.equal(aiMode({ AI_MODE: ' Remote ' }), 'remote');
  assert.deepEqual(defineArgs({ AI_MODE: 'remote' }, false), [
    '--define', "LUMA_AI_MODE='remote'", '--define', "LUMA_PUSH_ENABLED='false'", '--define', "LUMA_SUPPORT_WHATSAPP=''",
    '--define', "LUMA_CONTACT_EMAIL=''",
  ]);
  assert.throws(() => aiMode({ AI_MODE: 'gemini' }), FlagError);
});

test('the APK and the production build pass the flag (it was never read before round 8)', () => {
  assert.match(readFileSync(new URL('./apk.mjs', import.meta.url), 'utf8'), /'production,deploy', \.\.\.defineArgs\(env\)/);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts['build:prod'], /build-flags\.mjs ng build/);
  assert.match(readFileSync(new URL('../src/app/core/config/ai-mode.ts', import.meta.url), 'utf8'), /LUMA_AI_MODE === 'remote'/);
});

test('push follows Firebase: on with google-services.json, PUSH_ENABLED=0 turns it off, =1 without the file fails', () => {
  assert.equal(pushEnabled({}, true), true);
  assert.equal(pushEnabled({}, false), false);
  assert.equal(pushEnabled({ PUSH_ENABLED: '0' }, true), false);
  assert.throws(() => pushEnabled({ PUSH_ENABLED: '1' }, false), /google-services/);
  assert.throws(() => pushEnabled({ PUSH_ENABLED: 'yes' }, true), FlagError);
});

test('the support WhatsApp reaches the build (57 + 10 digits) or stays empty', () => {
  assert.equal(supportWhatsapp({}), '');
  assert.equal(supportWhatsapp({ SUPPORT_WHATSAPP: '+57 300 123 4567' }), '573001234567');
  assert.throws(() => supportWhatsapp({ SUPPORT_WHATSAPP: '3001234567' }), FlagError);
});

test('the legal contact e-mail is validated', () => {
  assert.equal(contactEmail({ LEGAL_CONTACT_EMAIL: ' Hola@Luma.co ' }), 'hola@luma.co');
  assert.throws(() => contactEmail({ LEGAL_CONTACT_EMAIL: 'hola' }), FlagError);
});
