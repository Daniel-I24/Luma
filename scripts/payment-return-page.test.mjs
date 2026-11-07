/**
 * public/pago-listo.*: the https page Wompi returns to from the APK, which hands
 * over to the app. Runs the real script against a minimal document.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../public/pago-listo.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../public/pago-listo.html', import.meta.url), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const ORDER = '11111111-1111-4111-8111-111111111111';

function run(search) {
  const link = { href: '' };
  let replaced = null;
  runInNewContext(script, {
    URLSearchParams,
    location: { search, replace: (url) => { replaced = url; } },
    document: { getElementById: () => link },
  });
  return { link: link.href, replaced };
}

test('the order and the transaction id Wompi added reach the app', () => {
  const { link, replaced } = run(`?order=${ORDER}&id=12345-1-sandbox`);
  assert.equal(link, `luma://payments/return?order=${ORDER}&id=12345-1-sandbox`);
  assert.equal(replaced, link, 'it tries on its own; the button stays for browsers that refuse');
});

test('nothing else gets through: no status, no script, no strange id', () => {
  const { link } = run(`?order=${ORDER}&id=${encodeURIComponent('"><script>')}&status=APPROVED&env=test`);
  assert.equal(link, `luma://payments/return?order=${ORDER}`);
  assert.equal(run('?status=APPROVED').link, 'luma://payments/return');
});

test('the page works under the strict CSP, and promises no result', () => {
  assert.ok(!/<script(?![^>]*src=)/.test(page), 'no inline script: script-src is self');
  assert.match(page, /src="\/pago-listo\.js"/);
  assert.match(page, /href="luma:\/\/payments\/return"/);
  assert.ok(!/aprobad|exitos|pago recibido/i.test(page), 'the redirect never says the payment went through');
  const all = vercel.headers.find((h) => h.source === '/(.*)').headers.find((h) => h.key === 'Content-Security-Policy').value;
  assert.match(all, /script-src 'self'/);
});
