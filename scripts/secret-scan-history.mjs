#!/usr/bin/env node
/**
 * Scans the whole git history (every line ever added, in every commit of
 * every ref) for what secret-scan.mjs looks for in the tree, plus Supabase
 * project references and personal e-mail addresses (PII). Prints commit,
 * file and kind, never the value. History is reported, not rewritten:
 * findings go to docs/security-findings.md.
 *
 *   node scripts/secret-scan-history.mjs
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { forbiddenFile, scanText } from './secret-scan.mjs';

/** A real project URL (20-letter reference); placeholders and examples are fine. */
const PROJECT_REF = /\bhttps:\/\/(?!placeholder\b|your-project\b|xyz\b)[a-z0-9]{20}\.supabase\.co\b|\bpostgres\.[a-z0-9]{20}@/;
/** An e-mail that is not an example, a no-reply or a role address. */
const EMAIL = /\b[A-Za-z0-9._%+-]+@(?!example\.|ejemplo\.|email\.com\b|b\.co\b|[\w.-]*\.(?:test|local|invalid)\b|[\w.-]*\.pooler\.supabase\.com\b|luma-test\.iam\.|anthropic\.com\b|users\.noreply\.github\.com\b)[A-Za-z0-9.-]+\.[a-z]{2,}\b/;
const ROLE_MAILBOX = /^(noreply|no-reply|soporte|support|privacidad|privacy|legal|hola|hello|security|seguridad)@/i;

/** Extra kinds for one added line. */
export function historyKinds(line) {
  const kinds = scanText(line).map((f) => f.kind);
  if (PROJECT_REF.test(line)) kinds.push('Supabase project reference');
  const email = EMAIL.exec(line)?.[0];
  if (email && !ROLE_MAILBOX.test(email)) kinds.push('personal e-mail address');
  return kinds;
}

/** Parses `git log -p` output into unique findings "commit file: kind". */
export function scanLog(log) {
  const findings = new Set();
  let commit = '';
  let file = '';
  for (const line of log.split('\n')) {
    if (line.startsWith('commit ')) commit = line.slice(7, 14);
    else if (line.startsWith('+++ b/')) {
      file = line.slice(6);
      const kind = forbiddenFile(file);
      if (kind) findings.add(`${commit} ${file}: ${kind}`);
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      for (const kind of historyKinds(line.slice(1))) findings.add(`${commit} ${file}: ${kind}`);
    }
  }
  return [...findings];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const log = execFileSync('git', ['log', '-p', '--all', '--no-color', '--no-ext-diff', '-U0'], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
  });
  const findings = scanLog(log);
  for (const finding of findings) process.stdout.write(`${finding}\n`);
  process.stdout.write(`secret-scan-history: ${findings.length} finding(s)\n`);
}
