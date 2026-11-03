/**
 * The checks of `npm run doctor`. Each one returns lines
 * { state: 'OK' | 'FALTA' | 'APAGADO', item, next? } in plain Spanish and
 * never a secret value. `ctx` gives the Management API, fetch, the local
 * migrations and the local secret files (scripts/doctor.mjs).
 */
import { FEATURES, FLAGS, FUNCTIONS } from './expected.mjs';

const ok = (item) => ({ state: 'OK', item });
const missing = (item, next) => ({ state: 'FALTA', item, next });
const off = (item, next) => ({ state: 'APAGADO', item, next });

/** Local migrations that the project has not applied yet. */
export async function checkMigrations(ctx) {
  const applied = new Set((await ctx.api('/database/migrations')).map((m) => String(m.version)));
  const pending = ctx.localMigrations.filter((version) => !applied.has(version));
  if (!pending.length) return [ok(`Migraciones: las ${ctx.localMigrations.length} están aplicadas`)];
  return [missing(`Migraciones sin aplicar: ${pending.join(', ')}`,
    'Revisa cada una (docs/migrations.md) y pégala en el SQL Editor en orden.')];
}

/** The app_settings flags, as they are. */
export async function checkFlags(ctx) {
  const list = FLAGS.map((key) => `'${key}'`).join(', ');
  const rows = await ctx.api('/database/query', {
    method: 'POST',
    body: { query: `select key, int_value from public.app_settings where key in (${list}) order by key` },
  });
  const values = new Map(rows.map((row) => [row.key, row.int_value]));
  return FLAGS.map((key) => (values.has(key) ? ok(`Bandera ${key} = ${values.get(key)}`)
    : missing(`Bandera ${key} no existe`, 'Aplica las migraciones pendientes.')));
}

/** Secret names and deployed functions of each feature. */
export async function checkFeatures(ctx) {
  const secrets = new Set((await ctx.api('/secrets')).map((s) => s.name));
  const functions = new Set((await ctx.api('/functions')).map((f) => f.slug));
  const lines = [];
  for (const feature of Object.values(FEATURES)) {
    const lacking = feature.secrets.filter((name) => !secrets.has(name));
    const undeployed = feature.functions.filter((name) => !functions.has(name));
    if (lacking.length === feature.secrets.length) {
      lines.push(off(`${feature.label}: sin configurar`, `Ejecuta scripts\\luma.ps1, opción ${feature.option}.`));
    } else if (lacking.length || undeployed.length) {
      const what = [...lacking.map((n) => `secreto ${n}`), ...undeployed.map((n) => `función ${n}`)].join(', ');
      lines.push(missing(`${feature.label}: falta ${what}`, `Ejecuta scripts\\luma.ps1, opción ${feature.option}.`));
    } else {
      lines.push(ok(`${feature.label}: secretos y funciones listos`));
    }
  }
  const others = FUNCTIONS.filter((name) => !functions.has(name));
  if (others.length) lines.push(missing(`Funciones sin desplegar: ${others.join(', ')}`, 'npx supabase functions deploy <nombre> --use-api'));
  return lines;
}

/** Meta's challenge against the deployed whatsapp-webhook, with the token of whatsapp.env. */
export async function checkWhatsappChallenge(ctx) {
  const token = ctx.secretFile('whatsapp.env').WHATSAPP_VERIFY_TOKEN;
  if (!token) return [off('Reto del webhook de WhatsApp: no hay whatsapp.env', 'Ejecuta scripts\\luma.ps1, opción 5.')];
  const challenge = String(ctx.random());
  const url = `${ctx.functionsUrl}/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(token)}&hub.challenge=${challenge}`;
  const response = await ctx.fetch(url, { method: 'GET' });
  const body = await response.text();
  if (response.ok && body.trim() === challenge) return [ok('Reto del webhook de WhatsApp: responde bien')];
  return [missing(`Reto del webhook de WhatsApp: respondió ${response.status}`,
    'Vuelve a la opción 5: el token de whatsapp.env y el secreto WHATSAPP_VERIFY_TOKEN deben ser iguales.')];
}

/** The Gemini key and models of ai.env, asked to Google (never printed). */
export async function checkGeminiKey(ctx) {
  const ai = ctx.secretFile('ai.env');
  if (!ai.LLM_API_KEY) return [off('Clave de Gemini: no hay ai.env', 'Ejecuta scripts\\luma.ps1, opción 1.')];
  const lines = [];
  for (const [label, model] of [['modelo', ai.LLM_MODEL], ['modelo de respaldo', ai.LLM_FALLBACK_MODEL]]) {
    if (!model) {
      lines.push(label === 'modelo' ? missing('Gemini: falta el modelo', 'Opción 1.') : off('Gemini: sin modelo de respaldo', 'Opcional: opción 1.'));
      continue;
    }
    const response = await ctx.fetch(`${ctx.geminiUrl}/models/${encodeURIComponent(model)}`, {
      method: 'GET', headers: { 'x-goog-api-key': ai.LLM_API_KEY },
    });
    await response.body?.cancel();
    if (response.ok) lines.push(ok(`Gemini: la clave sirve y el ${label} ${model} existe`));
    else if (response.status === 404) lines.push(missing(`Gemini: el ${label} ${model} no existe`, 'Elige otro en la opción 1.'));
    else lines.push(missing(`Gemini: la clave fue rechazada (${response.status})`, 'Crea otra clave en AI Studio y usa la opción 1.'));
  }
  return lines;
}

/** Push and payments as a whole: the database part only the SQL editor can show. */
export function checkLocalSetup(ctx) {
  const lines = [];
  lines.push(ctx.exists('push-settings.sql') ? ok('Push: push-settings.sql generado (pégalo una vez en el SQL Editor)')
    : off('Push: falta push-settings.sql', 'Ejecuta scripts\\luma.ps1, opción 2.'));
  lines.push(ctx.exists('payments-settings.sql') ? ok('Pagos: payments-settings.sql generado (pégalo una vez en el SQL Editor)')
    : off('Pagos: falta payments-settings.sql', 'Ejecuta scripts\\luma.ps1, opción 3.'));
  return lines;
}

export const CHECKS = [checkMigrations, checkFlags, checkFeatures, checkWhatsappChallenge, checkGeminiKey, checkLocalSetup];
