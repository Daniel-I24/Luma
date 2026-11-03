#!/usr/bin/env node
/**
 * `npm run doctor` (option 7 of scripts/luma.ps1): what is configured in the
 * Supabase project and what is missing, in plain Spanish. Reads only:
 *   - the project: supabase/.temp/project-ref (from "npx supabase link") or
 *     SUPABASE_PROJECT_REF;
 *   - the CLI session of "npx supabase login": secret NAMES and deployed
 *     functions ("npx supabase secrets list" and "functions list");
 *   - optionally SUPABASE_ACCESS_TOKEN, only in memory (option 7 asks for it
 *     as a SecureString and never writes it): migrations and app_settings
 *     flags, which only the Management API answers. Without it, those lines
 *     are APAGADO;
 *   - the secrets folder (LUMA_SECRETS_DIR, default %USERPROFILE%\luma-secrets):
 *     ai.env and whatsapp.env, to test the Gemini key and the WhatsApp challenge.
 *     No file there holds an account token.
 * Writes nothing and never prints a secret. Exit 1 when something is missing.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHECKS } from './doctor/checks.mjs';

export const API_URL = 'https://api.supabase.com/v1';
export const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta';

/** KEY=VALUE lines (quotes and comments allowed); an absent file is empty. */
export function parseEnvFile(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

/** The Supabase CLI with the user's own session ("npx supabase login"); JSON output. */
export function supabaseCli(args) {
  const run = spawnSync('npx', ['--yes', 'supabase', ...args, '--output', 'json'], {
    encoding: 'utf8', shell: process.platform === 'win32',
  });
  if (run.status !== 0) throw new Error(`"npx supabase ${args.slice(0, 2).join(' ')}" falló: ¿hiciste "npx supabase login"?`);
  return JSON.parse(run.stdout);
}

/** The context the checks use; every outside service comes through `fetchFn` and `cli`. */
export function createContext({ env = process.env, root = process.cwd(), fetchFn = fetch, random = Math.random, cli = supabaseCli } = {}) {
  const secretsDir = env.LUMA_SECRETS_DIR || join(env.USERPROFILE || homedir(), 'luma-secrets');
  const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '');
  const ref = (env.SUPABASE_PROJECT_REF || read(join(root, 'supabase', '.temp', 'project-ref'))).trim();
  if (!/^[a-z0-9]{20}$/.test(ref)) throw new Error('Falta el proyecto: ejecuta "npx supabase link" en la carpeta del repo.');
  const token = (env.SUPABASE_ACCESS_TOKEN ?? '').trim();
  // Only with a token given in memory: migrations and flags (Management API).
  const api = token ? async (path, { method = 'GET', body } = {}) => {
    const response = await fetchFn(`${API_URL}/projects/${ref}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`la API de Supabase respondió ${response.status} en ${path}`);
    return response.json();
  } : null;
  const migrationsDir = join(root, 'supabase', 'migrations');
  return {
    api,
    cli: (args) => cli([...args, '--project-ref', ref]),
    fetch: fetchFn,
    random: () => Math.floor(random() * 1e9),
    functionsUrl: `https://${ref}.supabase.co/functions/v1`,
    geminiUrl: GEMINI_URL,
    localMigrations: readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).map((f) => f.split('_')[0]).sort(),
    secretFile: (name) => parseEnvFile(read(join(secretsDir, name))),
    exists: (name) => existsSync(join(secretsDir, name)),
  };
}

/** Runs every check; a check that cannot run is a FALTA line, never a crash. */
export async function runDoctor(ctx) {
  const lines = [];
  for (const check of CHECKS) {
    try {
      lines.push(...(await check(ctx)));
    } catch (error) {
      lines.push({ state: 'FALTA', item: `No pude comprobar ${check.name.replace(/^check/, '')}: ${error.message}` });
    }
  }
  return lines;
}

export function format(lines) {
  const body = lines.map((l) => `${l.state.padEnd(7)} ${l.item}${l.next ? `\n        → ${l.next}` : ''}`);
  const missing = lines.filter((l) => l.state === 'FALTA').length;
  const summary = missing ? `Faltan ${missing} cosas: empieza por la primera de arriba.` : 'Todo lo que se puede comprobar desde aquí está bien.';
  return `${body.join('\n')}\n\n${summary}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const lines = await runDoctor(createContext());
    process.stdout.write(format(lines));
    process.exitCode = lines.some((l) => l.state === 'FALTA') ? 1 : 0;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
