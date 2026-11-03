/**
 * Checks a real Wompi sandbox event against our checksum algorithm before
 * payments are turned on (docs/payments.md). Reads the event JSON copied
 * from the sandbox dashboard and the events secret from WOMPI_EVENTS_SECRET;
 * computes the documented checksum and a few reasonable variants and prints
 * which one matches the event's checksum (or the X-Event-Checksum header
 * passed with --checksum). Never prints the secret.
 *
 *   $env:WOMPI_EVENTS_SECRET = "test_events_..."
 *   npm run check:wompi-event -- event.json [--checksum <X-Event-Checksum>]
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Value at a dotted path of event.data ("transaction.amount_in_cents"). */
export function valueAt(data, path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), data);
}

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

/** Name → checksum for the documented algorithm and its variants. */
export function candidates(event, secret) {
  const properties = event?.signature?.properties ?? [];
  const values = (list) => list.map((path) => String(valueAt(event.data, path) ?? '')).join('');
  const timestamp = String(event?.timestamp ?? '');
  const ordered = values(properties);
  const sorted = values([...properties].sort());
  return {
    'documented: properties (in order) + timestamp + secret': sha256(ordered + timestamp + secret),
    'properties sorted alphabetically + timestamp + secret': sha256(sorted + timestamp + secret),
    'timestamp + properties + secret': sha256(timestamp + ordered + secret),
    'properties + secret (no timestamp)': sha256(ordered + secret),
    'properties + timestamp (no secret: would be insecure)': sha256(ordered + timestamp),
  };
}

/** Names of the candidates equal to the expected checksum (case-insensitive). */
export function matches(event, secret, expected) {
  const target = String(expected ?? '').trim().toLowerCase();
  return Object.entries(candidates(event, secret))
    .filter(([, value]) => value === target)
    .map(([name]) => name);
}

function main(argv, env) {
  const file = argv.find((arg) => !arg.startsWith('--'));
  const flag = argv.indexOf('--checksum');
  const secret = env.WOMPI_EVENTS_SECRET?.trim();
  if (!file || !secret) {
    process.stderr.write('Usage: set WOMPI_EVENTS_SECRET, then npm run check:wompi-event -- event.json [--checksum X]\n');
    return 2;
  }
  const event = JSON.parse(readFileSync(file, 'utf8'));
  const expected = flag >= 0 ? argv[flag + 1] : event?.signature?.checksum;
  if (!expected) {
    process.stderr.write('The event has no signature.checksum; pass the X-Event-Checksum header with --checksum.\n');
    return 2;
  }
  process.stdout.write(`properties: ${(event.signature?.properties ?? []).join(', ')}\n`);
  const found = matches(event, secret, expected);
  for (const name of Object.keys(candidates(event, secret))) {
    process.stdout.write(`${found.includes(name) ? 'MATCH' : '  -  '}  ${name}\n`);
  }
  const documented = found.some((name) => name.startsWith('documented'));
  process.stdout.write(documented
    ? 'OK: the documented algorithm (used by wompi-webhook) matches this event.\n'
    : 'NO MATCH with the documented algorithm: do not enable payments (check the secret and the environment).\n');
  return documented ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2), process.env);
}
