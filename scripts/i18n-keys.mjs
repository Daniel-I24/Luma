/**
 * Static checks for the Transloco files: es.json and en.json must have the
 * same keys, and every key written as a literal in src/ must exist.
 * Only literals whose first segment is a top-level namespace of the
 * translation files count as keys, so `item.business.id` (an expression) or
 * `map.css` (a file) are never reported unless that namespace exists and the
 * literal is a real string, not an Angular expression.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const KEY_SHAPE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_-]+)+$/;
const FILE_NAME = /\.(css|html|js|mjs|json|ts|svg|png|jpe?g|webp|woff2)$/;
const SINGLE_QUOTED =/'([^'\\\n]*)'/g;
const BACKTICK = /`([^`\\$]*)`/g;
const STATIC_ATTRIBUTE = /\s[a-zA-Z][\w.-]*="([^"]*)"/g;

/** Dotted paths of every leaf string in a nested translation object. */
export function flattenKeys(tree, prefix = '') {
  return Object.entries(tree).flatMap(([name, value]) => {
    const path = prefix ? `${prefix}.${name}` : name;
    return value !== null && typeof value === 'object' ? flattenKeys(value, path) : [path];
  });
}

/** Keys present in one list and missing from the other. */
export function keyDifference(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  return {
    onlyInFirst: a.filter((key) => !setB.has(key)),
    onlyInSecond: b.filter((key) => !setA.has(key)),
  };
}

function matches(pattern, source) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

/**
 * Key-shaped string literals of a .ts or .html source. TypeScript: single
 * quotes and backticks without interpolation (double quotes appear only in
 * inline templates, where they wrap expressions). HTML: single-quoted
 * literals inside expressions and values of unbound attributes.
 */
export function extractKeyLiterals(source, kind, namespaces) {
  const literals =
    kind === 'html'
      ? [...matches(SINGLE_QUOTED, source), ...matches(STATIC_ATTRIBUTE, source)]
      : [...matches(SINGLE_QUOTED, source), ...matches(BACKTICK, source)];
  return literals.filter(
    (literal) =>
      KEY_SHAPE.test(literal) &&
      !FILE_NAME.test(literal) &&
      namespaces.has(literal.slice(0, literal.indexOf('.'))),
  );
}

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    const ext = extname(entry.name);
    return ext === '.ts' || ext === '.html' ? [path] : [];
  });
}

/** Every key-shaped literal in srcDir that is not a key of the translations. */
export function findMissingKeys(srcDir, translations) {
  const known = new Set(flattenKeys(translations));
  const namespaces = new Set(Object.keys(translations));
  const missing = [];
  for (const file of sourceFiles(srcDir)) {
    if (file.endsWith('.spec.ts')) continue;
    const kind = file.endsWith('.html') ? 'html' : 'ts';
    for (const key of extractKeyLiterals(readFileSync(file, 'utf8'), kind, namespaces)) {
      if (!known.has(key)) missing.push(`${key} (${file})`);
    }
  }
  return [...new Set(missing)];
}
