/**
 * npm run ai:smoke [-- recommend] — one real call to the AI provider through
 * the SAME code the Edge Functions run (Node 24 imports their TypeScript):
 * extract-menu reads scripts/fixtures/menu-sample.png, recommend ranks two
 * sample businesses. Reads functions.env (or ai.env) from the secrets folder
 * ($env:USERPROFILE\luma-secrets) and never prints a value from it.
 * Prints "OK: …" or "FALLO: <reason>"; the exit code is 0 only for OK.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const ORIGIN = 'http://localhost';
const BUSINESS = '00000000-0000-4000-8000-0000000000b1';

/** NAME=value lines (quotes and comments allowed); nothing is printed. */
export function readEnv(dir) {
  const file = ['functions.env', 'ai.env'].map((name) => join(dir, name)).find((path) => existsSync(path));
  if (!file) return null;
  const values = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

/** The provider of the functions, spying on its last result to report the exact reason. */
async function spiedProvider(env, fetchFn, purpose) {
  const { providerFromEnv } = await import('../supabase/functions/_shared/llm/config.ts');
  const provider = providerFromEnv((name) => env[name], fetchFn, purpose);
  if (!provider) return { provider: null, last: () => null };
  let last = null;
  const spied = {
    name: provider.name,
    generateJson: async (request, validate) => (last = await provider.generateJson(request, validate)),
  };
  return { provider: spied, last: () => last };
}

const post = (body) =>
  new Request('http://localhost/smoke', {
    method: 'POST',
    headers: { origin: ORIGIN, authorization: 'Bearer smoke', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

async function extractMenu(env, fetchFn) {
  const { createHandler } = await import('../supabase/functions/extract-menu/handler.ts');
  const { provider, last } = await spiedProvider(env, fetchFn, 'vision');
  const owner = { ownsBusiness: async () => true, withinRateLimit: async () => true, consumeQuota: async () => true };
  const handler = createHandler({ allowedOrigins: [ORIGIN], authenticate: async () => owner, llm: provider });
  const image = readFileSync(join(here, 'fixtures', 'menu-sample.png')).toString('base64');
  const response = await handler(post({ business_id: BUSINESS, images: [image] }));
  const body = await response.json();
  if (response.status === 200) return `OK: extract-menu leyo ${body.items.length} productos (${env.LLM_VISION_MODEL || env.LLM_MODEL})`;
  return `FALLO: extract-menu ${response.status} ${last()?.reason ?? body.reason ?? body.error}`;
}

const SAMPLE = [
  { id: 'b1', name: 'Cafetería La Prueba', category: 'Cafetería', km: 0.4, rating: 4.6, promotions: [],
    items: [{ id: 'i1', name: 'Calentado', price_cop: 12000, section: 'Desayunos' }, { id: 'i2', name: 'Tinto', price_cop: 2000, section: 'Bebidas' }] },
  { id: 'b2', name: 'Panadería El Horno', category: 'Panadería', km: 1.2, rating: null, promotions: [],
    items: [{ id: 'i3', name: 'Pan de yuca', price_cop: 1500, section: 'Panadería' }] },
];

async function recommend(env, fetchFn) {
  const { createHandler } = await import('../supabase/functions/recommend/handler.ts');
  const { provider, last } = await spiedProvider(env, fetchFn, 'text');
  const caller = { consumeQuota: async () => true, candidates: async () => SAMPLE };
  const cache = { get: async () => null, put: async () => undefined };
  const handler = createHandler({ allowedOrigins: [ORIGIN], authenticate: async () => caller, cache, llm: provider });
  const response = await handler(post({ moment: 'breakfast', lat: 1.2136, lng: -77.2811, radius_km: 5 }));
  const body = await response.json();
  if (response.status === 200) return `OK: recommend eligio ${body.businesses.length} negocios (${env.LLM_MODEL})`;
  return `FALLO: recommend ${response.status} ${last()?.reason ?? (provider ? body.error : 'not_configured')}`;
}

/** Runs one smoke test; `fetchFn` is the real fetch unless a test passes another. */
export async function smoke(which, env, fetchFn) {
  if (Number(process.versions.node.split('.')[0]) < 24) return `FALLO: necesita Node 24 (este es ${process.versions.node})`;
  if (!env) return 'FALLO: no hay functions.env ni ai.env en la carpeta de secretos';
  return which === 'recommend' ? recommend(env, fetchFn) : extractMenu(env, fetchFn);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = process.env.LUMA_SECRETS_DIR || join(process.env.USERPROFILE || homedir(), 'luma-secrets');
  const line = await smoke(process.argv[2], readEnv(dir));
  console.log(line);
  process.exitCode = line.startsWith('OK') ? 0 : 1;
}
