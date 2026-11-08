import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PAGES, renderAll, sectionOrder } from './build-legal.mjs';

const documents = () => renderAll({}).filter(([path]) => !path.endsWith('/index.html'));
const legal = JSON.parse(readFileSync(new URL('../public/i18n/es.json', import.meta.url), 'utf8')).legal;

test('the committed public pages are the app texts (npm run build:legal after changing them)', () => {
  for (const [path, html] of renderAll({})) assert.equal(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), html, path);
});

test('every section of the app, in its order, and the four pages', () => {
  const order = sectionOrder();
  assert.deepEqual(Object.keys(PAGES).sort(), Object.keys(order).sort());
  for (const [path, html] of documents()) {
    const doc = Object.keys(PAGES).find((key) => path.endsWith(`/${PAGES[key]}.html`));
    const positions = order[doc].map((id) => html.indexOf(`<h2>${legal[doc].sections[id].title.replace(/"/g, '&quot;')}</h2>`));
    assert.ok(positions.every((at, i) => at > 0 && (i === 0 || at > positions[i - 1])), doc);
    assert.match(html, /<html lang="es">/);
    assert.doesNotMatch(html, /<script/);
  }
});

test('the index lists the four pages with relative links, valid under /legal/ (Vercel) and /Luma/ (Pages)', () => {
  const [path, html] = renderAll({}).at(-1);
  assert.equal(path, 'public/legal/index.html');
  assert.equal(documents().length, 4);
  for (const [key, slug] of Object.entries(PAGES)) assert.ok(html.includes(`<a href="${slug}.html">${legal[key].title}</a>`), slug);
  assert.match(html, /<html lang="es">/);
  assert.ok(html.includes(legal.indexTitle));
  assert.ok(html.includes(legal.draftNotice));
});

test('every page fits the Vercel CSP and links between pages work on both hosts', () => {
  for (const [path, html] of renderAll({})) {
    assert.doesNotMatch(html, /<script|\son\w+=|\ssrc=|<link\s/, `${path}: nothing the CSP blocks`);
    assert.doesNotMatch(html, /href="\//, `${path}: no absolute links (Pages serves under /Luma/)`);
    assert.match(html, /<style>/, `${path}: one inline style (style-src 'unsafe-inline')`);
  }
});

test('the data deletion page explains Perfil → Eliminar cuenta and uses the configured e-mail', () => {
  const [, html] = renderAll({ LEGAL_CONTACT_EMAIL: 'privacidad@luma.co' }).find(([path]) => path.endsWith('eliminacion-datos.html'));
  assert.match(html, /Perfil/);
  assert.match(html, /Eliminar cuenta/);
  assert.match(html, /privacidad@luma\.co/);
  assert.doesNotMatch(html, /\{\{email\}\}/);
});
