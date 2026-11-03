#!/usr/bin/env node
/**
 * Build flags that are not secrets, passed to `ng build` as `--define`
 * (never written to src/environments):
 *   - AI_MODE: "rules" (default) or "remote" → LUMA_AI_MODE in the bundle
 *     (src/app/core/config/build-flags.ts reads it).
 *   - PUSH_ENABLED: "1" or "0"; unset → on when android/app/google-services.json
 *     exists (push without it crashes the Android app, so "1" without the file
 *     fails) → LUMA_PUSH_ENABLED (src/app/core/push/push-platform.ts).
 *   - SUPPORT_WHATSAPP: Luma's support WhatsApp, 57 + 10 digits (no "+"),
 *     empty by default → LUMA_SUPPORT_WHATSAPP (src/app/core/config/build-flags.ts).
 *   - LEGAL_CONTACT_EMAIL: the contact e-mail of the legal texts, empty by
 *     default → LUMA_CONTACT_EMAIL (also used by scripts/build-legal.mjs).
 * Used by scripts/apk.mjs and `npm run build:prod`. An unknown value fails
 * the build instead of silently shipping "rules".
 *
 *   node scripts/build-flags.mjs ng build --configuration production,deploy
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export class FlagError extends Error {}

const AI_MODES = ['rules', 'remote'];

/** The AI mode of the build: AI_MODE trimmed and in lower case; rules when unset. */
export function aiMode(env) {
  const value = (env.AI_MODE ?? '').trim().toLowerCase() || 'rules';
  if (!AI_MODES.includes(value)) throw new FlagError(`AI_MODE must be "rules" or "remote" (got "${env.AI_MODE}").`);
  return value;
}

/** Push in this build: PUSH_ENABLED when set, else whether Firebase is configured. */
export function pushEnabled(env, googleServices = existsSync('android/app/google-services.json')) {
  const value = (env.PUSH_ENABLED ?? '').trim().toLowerCase();
  if (value === '') return googleServices;
  if (!['1', 'true', '0', 'false'].includes(value)) throw new FlagError(`PUSH_ENABLED must be 1 or 0 (got "${env.PUSH_ENABLED}").`);
  const on = value === '1' || value === 'true';
  if (on && !googleServices) throw new FlagError('PUSH_ENABLED=1 needs android/app/google-services.json (docs/push-setup.md).');
  return on;
}

/** Support WhatsApp in E.164 without "+": "573001234567"; "" when unset. */
export function supportWhatsapp(env) {
  const digits = (env.SUPPORT_WHATSAPP ?? '').replace(/[\s+-]/g, '');
  if (digits && !/^57[0-9]{10}$/.test(digits)) throw new FlagError('SUPPORT_WHATSAPP must be 57 and 10 digits, e.g. 573001234567.');
  return digits;
}

/** The legal contact e-mail, validated; "" when unset. */
export function contactEmail(env) {
  const value = (env.LEGAL_CONTACT_EMAIL ?? '').trim().toLowerCase();
  if (value && !/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(value)) throw new FlagError('LEGAL_CONTACT_EMAIL is not an e-mail.');
  return value;
}

/** The `--define` arguments of `ng build` (single quotes survive cmd.exe on Windows). */
export function defineArgs(env, googleServices) {
  return [
    '--define', `LUMA_AI_MODE='${aiMode(env)}'`,
    '--define', `LUMA_PUSH_ENABLED='${pushEnabled(env, googleServices)}'`,
    '--define', `LUMA_SUPPORT_WHATSAPP='${supportWhatsapp(env)}'`,
    '--define', `LUMA_CONTACT_EMAIL='${contactEmail(env)}'`,
  ];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (!command) throw new FlagError('usage: node scripts/build-flags.mjs <command> [args]');
    process.stdout.write(`build-flags: AI_MODE=${aiMode(process.env)} PUSH_ENABLED=${pushEnabled(process.env)}\n`);
    const result = spawnSync(command, [...args, ...defineArgs(process.env)], { stdio: 'inherit', shell: process.platform === 'win32' });
    process.exitCode = result.status ?? 1;
  } catch (error) {
    process.stderr.write(`build-flags: ${error instanceof FlagError ? error.message : 'unexpected error'}\n`);
    process.exitCode = 1;
  }
}
