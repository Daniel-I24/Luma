/**
 * Builds public/data/dane-municipalities.json from the DANE DIVIPOLA list
 * (datos.gov.co dataset gdxc-w37w, JSON export). The input is treated as
 * data: every row is shape-checked and anything unexpected stops the build.
 *
 *   node scripts/dane-catalog.mjs <divipola.json>
 *
 * Output: { "source", "departments": [[code, name]], "municipalities": [[code, name, lat, lng]] }
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DEPARTMENT_CODE = /^[0-9]{2}$/;
const MUNICIPALITY_CODE = /^[0-9]{5}$/;
const NAME = /^[\p{L} .,'()-]{2,60}$/u;
const SMALL_WORDS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e']);
const COORDINATE_DECIMALS = 4;
const MIN_MUNICIPALITIES = 1000;

/** "SAN ANDRÉS DE TUMACO" -> "San Andrés de Tumaco". */
export function titleCase(name) {
  return name
    .toLocaleLowerCase('es-CO')
    .split(' ')
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toLocaleUpperCase('es-CO') + word.slice(1)))
    .join(' ');
}

const coordinate = (value, min, max) => {
  const number = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`bad coordinate ${value}`);
  return Number(number.toFixed(COORDINATE_DECIMALS));
};

/** Validated, sorted catalog from the raw DIVIPOLA rows. */
export function buildCatalog(rows) {
  if (!Array.isArray(rows) || rows.length < MIN_MUNICIPALITIES) throw new Error('unexpected input');
  const departments = new Map();
  const municipalities = new Map();
  for (const row of rows) {
    const { cod_dpto: dept, dpto, cod_mpio: code, nom_mpio: name, latitud, longitud } = row ?? {};
    if (!DEPARTMENT_CODE.test(dept) || !MUNICIPALITY_CODE.test(code) || !code.startsWith(dept)) throw new Error(`bad code ${code}`);
    if (!NAME.test(dpto) || !NAME.test(name)) throw new Error(`bad name ${code}`);
    departments.set(dept, titleCase(dpto));
    municipalities.set(code, [code, titleCase(name), coordinate(latitud, -5, 14), coordinate(longitud, -82, -66)]);
  }
  const byCode = (a, b) => a[0].localeCompare(b[0]);
  return {
    source: 'DANE DIVIPOLA (datos.gov.co gdxc-w37w)',
    departments: [...departments.entries()].sort(byCode),
    municipalities: [...municipalities.values()].sort(byCode),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const input = process.argv[2];
  if (!input) throw new Error('usage: node scripts/dane-catalog.mjs <divipola.json>');
  const catalog = buildCatalog(JSON.parse(readFileSync(input, 'utf8')));
  const out = fileURLToPath(new URL('../public/data/dane-municipalities.json', import.meta.url));
  writeFileSync(out, JSON.stringify(catalog) + '\n');
  process.stdout.write(`${catalog.departments.length} departments, ${catalog.municipalities.length} municipalities\n`);
}
