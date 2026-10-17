import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  extractKeyLiterals,
  findMissingKeys,
  flattenKeys,
  flattenPaths,
  keyDifference,
} from './i18n-keys.mjs';

const read = (lang) =>
  JSON.parse(readFileSync(new URL(`../public/i18n/${lang}.json`, import.meta.url), 'utf8'));
const es = read('es');
const en = read('en');
const NAMESPACES = new Set(['map', 'orders', 'status']);

test('es.json and en.json have exactly the same keys', () => {
  assert.deepEqual(keyDifference(flattenKeys(es), flattenKeys(en)), {
    onlyInFirst: [],
    onlyInSecond: [],
  });
});

test('every key written as a literal in src/ exists in the translations', () => {
  assert.deepEqual(findMissingKeys(fileURLToPath(new URL('../src', import.meta.url)), es), []);
});

test('flattens nested objects into dotted leaf paths', () => {
  assert.deepEqual(flattenKeys({ a: { b: 'x', c: { d: 'y' } }, e: 'z' }), ['a.b', 'a.c.d', 'e']);
});

test('lists namespaces and leaves, so prefix literals count as known', () => {
  assert.deepEqual(flattenPaths({ a: { b: 'x' }, c: 'y' }), ['a', 'a.b', 'c']);
});

test('reports keys missing on either side', () => {
  assert.deepEqual(keyDifference(['a', 'b'], ['b', 'c']), {
    onlyInFirst: ['a'],
    onlyInSecond: ['c'],
  });
});

test('extracts TypeScript literals but not interpolated or foreign strings', () => {
  const source =
    "t('map.sheet.title'); `orders.list.empty`; `orders.status.${s}`; import x from './map.page'; 'map.css'; 'other.key'";
  assert.deepEqual(extractKeyLiterals(source, 'ts', NAMESPACES), [
    'map.sheet.title',
    'orders.list.empty',
  ]);
});

test('extracts HTML literals and static attributes but not bound expressions', () => {
  const source = `<p>{{ 'map.title' | transloco }}</p>
<x-empty titleKey="orders.empty.title" [rating]="status.rating" (click)="map.reset()" />`;
  assert.deepEqual(extractKeyLiterals(source, 'html', NAMESPACES), [
    'map.title',
    'orders.empty.title',
  ]);
});

test('ignores prefixes and non key shapes', () => {
  assert.deepEqual(
    extractKeyLiterals("'orders.status.' 'map' 'map..x' 'map.a b'", 'ts', NAMESPACES),
    [],
  );
});
