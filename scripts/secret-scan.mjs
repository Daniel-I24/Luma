#!/usr/bin/env node
/**
 * Fails when a tracked file holds something that must never be committed:
 * service_role JWTs, Supabase secret keys, private keys, common provider API
 * keys (Google, Anthropic, OpenAI, GitHub, MapTiler-looking tokens are not
 * matched: too generic), keystores, Firebase config and service accounts.
 * Scans `git ls-files` (what CI and a push would publish). Prints file:line
 * and the kind of finding, never the value.
 *
 *   node scripts/secret-scan.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Files that must not be tracked at all. */
const FORBIDDEN_FILES = [
  [/(^|\/)google-services\.json$/, 'Firebase config (google-services.json)'],
  [/(^|\/)GoogleService-Info\.plist$/, 'Firebase config (plist)'],
  [/\.(jks|keystore|p12|pfx)$/i, 'keystore'],
  [/(^|\/)keystore\.properties$/, 'keystore passwords'],
  [/service-account[^/]*\.json$/i, 'service account'],
  [/(^|\/)src\/environments\/environment(\.deploy)?\.ts$/, 'environment file with real keys'],
  [/(^|\/)\.env(\.[a-z]+)?$/, '.env file'],
  [/(^|\/)[\w.-]+\.env$/, 'env file of secrets (app.env, functions.env, web.env)'],
  [/(^|\/)luma-secrets\//, 'luma-secrets folder'],
  [/(^|\/)wompi-sandbox\.txt$/, 'Wompi keys'],
  [/(^|\/)supabase\/\.temp\//, 'Supabase CLI link data (project reference)'],
];

const PATTERNS = [
  [/-----BEGIN (RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/, 'private key'],
  [/\bsb_secret_[A-Za-z0-9_-]{10,}/, 'Supabase secret key'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'Google API key'],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/, 'Anthropic API key'],
  [/\bsk-(proj-)?[A-Za-z0-9]{32,}/, 'OpenAI-style API key'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, 'GitHub token'],
  [/\bgsk_[A-Za-z0-9]{40,}\b/, 'Groq API key'],
  [/\bprv_(?:test|prod|stagtest)_[A-Za-z0-9]{20,}/, 'Wompi private key'],
  [/\b(?:test|prod|stagtest)_(?:events|integrity)_[A-Za-z0-9]{20,}/, 'Wompi secret'],
];

const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

/** "service_role" when a JWT carries that role (only privileged ones are secrets). */
export function jwtRole(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).role ?? null;
  } catch {
    return null;
  }
}

/** Findings of one file: [{ line, kind }]. */
export function scanText(text) {
  const findings = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const [pattern, kind] of PATTERNS) if (pattern.test(line)) findings.push({ line: index + 1, kind });
    for (const token of line.match(JWT) ?? []) {
      if (jwtRole(token) === 'service_role') findings.push({ line: index + 1, kind: 'service_role JWT' });
    }
  });
  return findings;
}

export function forbiddenFile(path) {
  return FORBIDDEN_FILES.find(([pattern]) => pattern.test(path))?.[1] ?? null;
}

export function scan(files, read = (f) => readFileSync(f, 'utf8')) {
  const problems = [];
  for (const file of files) {
    const kind = forbiddenFile(file);
    if (kind) {
      problems.push(`${file}: ${kind} must not be committed`);
      continue;
    }
    let text;
    try {
      text = read(file);
    } catch {
      continue;
    }
    // Binary or huge generated files.
    if (text.length > 5_000_000 || text.includes('\u0000')) continue;
    for (const finding of scanText(text)) problems.push(`${file}:${finding.line}: ${finding.kind}`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\u0000').filter(Boolean);
  const problems = scan(files);
  for (const problem of problems) process.stdout.write(`${problem}\n`);
  process.stdout.write(problems.length ? `secret-scan: ${problems.length} finding(s)\n` : `secret-scan: ok (${files.length} files)\n`);
  process.exitCode = problems.length ? 1 : 0;
}
