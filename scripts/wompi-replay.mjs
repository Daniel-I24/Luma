/**
 * Sends a REAL sandbox transaction to wompi-webhook again, signed with the sandbox
 * events secret: the checks a phone cannot do (docs/payments-setup.md). The owner
 * runs it; it reads the secret from %USERPROFILE%\luma-secrets and never prints it.
 *
 *   npm run wompi:replay -- <transaction id>
 *
 * 1. bad signature: must be refused (400).  2. repeated event: must answer 200.
 * 3. late event, a day old: must answer 200. The webhook confirms with Wompi's API,
 * so none of this can approve what Wompi did not. Refuses anything but test_ secrets.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SANDBOX_API = 'https://sandbox.wompi.co/v1/transactions';
const PROPERTIES = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
const DAY_MS = 86_400_000;

/** The test_events_ secret of a text; null when there is none. */
export function eventsSecretFrom(text) {
  return /(?<![A-Za-z0-9_])test_events_[A-Za-z0-9_]+/.exec(text)?.[0] ?? null;
}

/** A transaction.updated event as Wompi signs it (docs/payments.md). */
export function signedEvent(transaction, secret, timestamp) {
  const values = [transaction.id, transaction.status, transaction.amount_in_cents].join('');
  const checksum = createHash('sha256').update(`${values}${timestamp}${secret}`, 'utf8').digest('hex');
  return {
    event: 'transaction.updated',
    environment: 'test',
    timestamp,
    sent_at: new Date(timestamp).toISOString(),
    data: { transaction },
    signature: { properties: PROPERTIES, checksum },
  };
}

/** The three checks, as lines { name, status, ok }. */
export async function replay({ webhookUrl, transaction, secret, now, fetchFn }) {
  const post = async (event) =>
    (await fetchFn(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) })).status;
  const event = signedEvent(transaction, secret, now);
  const forged = { ...event, signature: { ...event.signature, checksum: '0'.repeat(64) } };
  const lines = [];
  const check = async (name, sent, expected) => {
    const status = await post(sent);
    lines.push({ name, status, ok: status === expected });
  };
  await check('Firma falsa: rechazada (400)', forged, 400);
  await check('Evento repetido: aceptado una vez mas (200)', event, 200);
  await check('Evento repetido otra vez: sin efecto (200)', event, 200);
  await check('Evento tardio, de ayer: sin efecto (200)', signedEvent(transaction, secret, now - DAY_MS), 200);
  return lines;
}

async function main(argv, env) {
  const id = argv[0];
  const dir = env.LUMA_SECRETS_DIR || join(env.USERPROFILE || homedir(), 'luma-secrets');
  const refPath = join(process.cwd(), 'supabase', '.temp', 'project-ref');
  const file = join(dir, 'wompi-sandbox.txt');
  if (!id || !existsSync(file) || !existsSync(refPath)) {
    process.stderr.write('Uso: npm run wompi:replay -- <id de la transaccion de sandbox>\n');
    return 2;
  }
  const secret = eventsSecretFrom(readFileSync(file, 'utf8'));
  if (!secret) {
    process.stderr.write('wompi-sandbox.txt no tiene una llave test_events_.\n');
    return 2;
  }
  const answer = await fetch(`${SANDBOX_API}/${encodeURIComponent(id)}`);
  if (!answer.ok) {
    process.stderr.write(`El sandbox de Wompi no conoce esa transaccion (${answer.status}).\n`);
    return 1;
  }
  const { data: transaction } = await answer.json();
  const ref = readFileSync(refPath, 'utf8').trim();
  const lines = await replay({
    webhookUrl: `https://${ref}.supabase.co/functions/v1/wompi-webhook`, transaction, secret, now: Date.now(), fetchFn: fetch,
  });
  for (const line of lines) process.stdout.write(`${line.ok ? 'OK   ' : 'FALLA'} ${line.name}: respondio ${line.status}\n`);
  return lines.every((line) => line.ok) ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main(process.argv.slice(2), process.env);
}
