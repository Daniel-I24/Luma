import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { buildCatalog, titleCase } from './dane-catalog.mjs';

const row = (code, name, extra = {}) => ({
  cod_dpto: code.slice(0, 2), dpto: 'NARIÑO', cod_mpio: code, nom_mpio: name, latitud: '1,2124', longitud: '-77,2788', ...extra,
});
const many = (extra) => Array.from({ length: 1000 }, (_, i) => row(`52${String(i).padStart(3, '0')}`, 'PASTO', extra));

test('names are title case with small Spanish words in lower case', () => {
  assert.equal(titleCase('SAN ANDRÉS DE TUMACO'), 'San Andrés de Tumaco');
  assert.equal(titleCase('VALLE DEL CAUCA'), 'Valle del Cauca');
});

test('rows are validated; anything odd stops the build', () => {
  assert.equal(buildCatalog(many()).municipalities[0][2], 1.2124);
  assert.throws(() => buildCatalog(many({ cod_mpio: '5200' })));
  assert.throws(() => buildCatalog(many({ nom_mpio: '<script>' })));
  assert.throws(() => buildCatalog(many({ latitud: '91' })));
  assert.throws(() => buildCatalog([row('52001', 'PASTO')]));
});

test('the bundled catalog is complete, sorted and has Pasto', () => {
  const catalog = JSON.parse(readFileSync(new URL('../public/data/dane-municipalities.json', import.meta.url), 'utf8'));
  assert.equal(catalog.departments.length, 33);
  assert.ok(catalog.municipalities.length > 1100);
  assert.deepEqual(catalog.municipalities.find((m) => m[0] === '52001').slice(0, 2), ['52001', 'Pasto']);
  const codes = catalog.municipalities.map((m) => m[0]);
  assert.deepEqual(codes, [...codes].sort());
  assert.ok(catalog.municipalities.every(([code]) => catalog.departments.some(([dept]) => code.startsWith(dept))));
});
