/**
 * Fails when a colour or a size is written as a literal instead of a design
 * token: hex, rgb(), hsl(), oklch() colours and px, rem and em lengths (0 allowed) in
 * src/app (CSS, templates, inline templates and style strings in TS) and in
 * the global stylesheets. Literals belong only in the token files
 * (src/styles/scale.css, tokens.css, themes/*, fonts.css). Comments and
 * tests are not scanned.
 *
 *   node scripts/check-design-tokens.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCANNED = [join('src', 'app'), join('src', 'styles')];
const TOKEN_FILES = [
  join('src', 'styles', 'scale.css'),
  join('src', 'styles', 'keyframes.css'),
  join('src', 'styles', 'tokens.css'),
  join('src', 'styles', 'fonts.css'),
  join('src', 'styles', 'themes'),
];
const EXTENSIONS = new Set(['.ts', '.html', '.css']);
const TEST_FILE = /\.spec\.ts$/;

const COLOR = /(?<![\w&])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab)\(/gi;
const PX = /(?<![\w.$-])(?!0(?:px|r?em)\b)\d*\.?\d+(?:px|r?em)\b/g;
/** In TS only string literals are style values (e.g. '#fff', '12px', `${x}px` is computed). */
const TS_STRING = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

/** Replaces comments with spaces, keeping line numbers. */
export function stripComments(text, extension) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  let out = text.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (extension === '.html') out = out.replace(/<!--[\s\S]*?-->/g, blank);
  if (extension === '.ts') out = out.replace(/(^|[^:'"`])\/\/.*$/gm, (m, lead) => lead + blank(m.slice(lead.length)));
  return out;
}

/** Literal colours and sizes in one file's text: [{ line, value }]. */
export function findLiterals(text, extension) {
  const clean = stripComments(text, extension);
  const regions = extension === '.ts' ? [...clean.matchAll(TS_STRING)] : [{ 0: clean, index: 0 }];
  const findings = [];
  const lineOf = (index) => clean.slice(0, index).split('\n').length;
  for (const region of regions) {
    for (const pattern of [COLOR, PX]) {
      for (const match of region[0].matchAll(pattern)) {
        findings.push({ line: lineOf(region.index + match.index), value: match[0] });
      }
    }
  }
  return findings.sort((a, b) => a.line - b.line);
}

const isTokenFile = (path) => TOKEN_FILES.some((allowed) => path === allowed || path.startsWith(allowed + sep));

function* sources(dir) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) yield* sources(path);
    else if (EXTENSIONS.has(extname(name)) && !TEST_FILE.test(name) && !isTokenFile(path)) yield path;
  }
}

export function scan() {
  const report = [];
  for (const dir of SCANNED) {
    for (const path of sources(dir)) {
      for (const f of findLiterals(readFileSync(join(ROOT, path), 'utf8'), extname(path))) {
        report.push(`${relative(ROOT, join(ROOT, path))}:${f.line} literal "${f.value}", use a design token`);
      }
    }
  }
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = scan();
  if (report.length) {
    process.stderr.write(`check-design-tokens: ${report.length} literal(s):\n${report.join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('check-design-tokens: ok\n');
}
