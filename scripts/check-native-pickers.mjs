/**
 * Fails when the app uses a native picker: a <select> (Android shows its own
 * grey dialog) or an <input> of type time, date, datetime-local, month or week
 * (the system clock and calendar). Choices go through LumaSelect, a bottom
 * sheet with the app's style. Templates, inline templates in TS and specs are
 * scanned; comments are not.
 *
 *   node scripts/check-native-pickers.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCANNED = join('src', 'app');
const EXTENSIONS = new Set(['.ts', '.html']);
const TEST_FILE = /\.spec\.ts$/;
const SELECT = /<select[\s>]/gi;
const PICKER_INPUT = /<(?:input|app-luma-input)\b[^>]*\btype\s*=\s*["'](?:time|date|datetime-local|month|week)["']/gi;

/** Replaces comments with spaces, keeping line numbers. */
export function stripComments(text) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return text
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:'"`])\/\/.*$/gm, (m, lead) => lead + blank(m.slice(lead.length)));
}

/** Native pickers in one file's text: [{ line, tag }]. */
export function findNativePickers(text) {
  const clean = stripComments(text);
  const lineOf = (index) => clean.slice(0, index).split('\n').length;
  const found = [];
  for (const pattern of [SELECT, PICKER_INPUT]) {
    for (const match of clean.matchAll(pattern)) found.push({ line: lineOf(match.index), tag: match[0].replace(/\s+/g, ' ').slice(0, 60) });
  }
  return found.sort((a, b) => a.line - b.line);
}

function* sources(dir) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) yield* sources(path);
    else if (EXTENSIONS.has(extname(name)) && !TEST_FILE.test(name)) yield path;
  }
}

/** Every native picker under src/app: ["file:line <tag"]. */
export function scan(dir = SCANNED) {
  const problems = [];
  for (const path of sources(dir)) {
    for (const { line, tag } of findNativePickers(readFileSync(join(ROOT, path), 'utf8'))) {
      problems.push(`${relative(ROOT, join(ROOT, path)).replaceAll('\\', '/')}:${line} ${tag}`);
    }
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const problems = scan();
  if (problems.length) {
    console.error(`check-native-pickers: ${problems.length} native picker(s); use LumaSelect:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log('check-native-pickers: ok');
}
