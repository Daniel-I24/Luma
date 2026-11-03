#!/usr/bin/env node
/**
 * `npm run doctor` (option 7 of scripts/luma.ps1): what is configured in the
 * Supabase project and what is missing, in plain Spanish. Reads only:
 *   - the project: supabase/.temp/project-ref (from "npx supabase link") or
 *     SUPABASE_PROJECT_REF;
 *   - a personal access token: SUPABASE_ACCESS_TOKEN or
 *     <secrets>/supabase-access-token.txt (Management API: migrations,
 *     app_settings flags, secret NAMES, functions);
 *   - the secrets folder (LUMA_SECRETS_DIR, default %USERPROFILE%\luma-secrets):
 *     ai.env and whatsapp.env, to test the Gemini key and the WhatsApp challenge.
 * Writes nothing and never prints a secret. Exit 1 when something is missing.
 */
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

/** The context the checks use; every outside service comes through `fetchFn`. */
export function createContext({ env = process.env, root = process.cwd(), fetchFn = fetch, random = Math.random } = {}) {
  const secretsDir = env.LUMA_SECRETS_DIR || join(env.USERPROFILE || homedir(), 'luma-secrets');
  const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '');
  const ref = (env.SUPABASE_PROJECT_REF || read(join(root, 'supabase', '.temp', 'project-ref'))).trim();
  const token = (env.SUPABASE_ACCESS_TOKEN || read(join(secretsDir, 'supabase-access-token.txt'))).trim();
  if (!/^[a-z0-9]{20}$/.test(ref)) throw new Error('Falta el proyecto: ejecuta "npx supabase link" en la carpeta del repo.');
  if (!token) {
    throw new Error('Falta el token de acceso: créalo en supabase.com/dashboard/account/tokens y guárdalo en '
      + `${join(secretsDir, 'supabase-access-token.txt')} (la opción 7 de scripts\\luma.ps1 lo pide).`);
  }
  const api = async (path, { method = 'GET', body } = {}) => {
    const response = await fetchFn(`${API_URL}/projects/${ref}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`la API de Supabase respondió ${response.status} en ${path}`);
    return response.json();
  };
  const migrationsDir = join(root, 'supabase', 'migrations');
  return {
    api,
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
