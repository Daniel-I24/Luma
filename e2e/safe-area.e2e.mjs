import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { BUSINESS_ID, CUSTOMER_EMAIL, OWNER_EMAIL } from './support/data.mjs';
import { openApp, skipGuide, startBrowser } from './support/harness.mjs';

/**
 * Phones with a notch (59 px on top, 34 px below) and without one: nothing to read or tap
 * under the status bar, and no two controls on top of each other, on every main screen.
 * The insets are emulated through the DevTools protocol: Chromium only.
 */
const skip = process.env.E2E_BROWSER === 'webkit' ? 'the inset emulation is Chromium only' : false;
const CUSTOMER = ['/map', '/feed', '/promotions', '/ai', '/orders', '/notifications', '/profile', '/favorites', '/account/details', '/account/data', '/help'];
const OWNER = ['summary', 'orders', 'menu', 'promotions'].map((tab) => `/owner/${BUSINESS_ID}/${tab}`);
/** A small phone with a notch is the worst case; a big one with and without it. */
const CASES = [[320, 568, 59], [390, 844, 59], [390, 844, 0]];

let env;
before(async () => { if (!skip) env = await startBrowser(); });
after(() => env?.close());

/** Runs in the page: what sits under the status bar and which controls overlap. */
function audit(inset) {
  const problems = [];
  for (const el of document.querySelectorAll('body *')) if (el.scrollTop) el.scrollTop = 0;
  /** The part of an element its scrolling ancestors let through. */
  const seen = (el) => {
    const r = el.getBoundingClientRect();
    let box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    for (let up = el.parentElement; up; up = up.parentElement) {
      if (getComputedStyle(up).overflowY === 'visible' && getComputedStyle(up).overflowX === 'visible') continue;
      const c = up.getBoundingClientRect();
      box = { left: Math.max(box.left, c.left), top: Math.max(box.top, c.top), right: Math.min(box.right, c.right), bottom: Math.min(box.bottom, c.bottom) };
    }
    return box;
  };
  const name = (el) => `<${el.tagName.toLowerCase()}> "${(el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)}"`;
  const shown = (el) => {
    const r = seen(el);
    const s = getComputedStyle(el);
    return r.right - r.left > 1 && r.bottom - r.top > 1 && r.bottom > 0 && r.top < innerHeight && s.visibility !== 'hidden' && Number(s.opacity) > 0;
  };
  const visible = (el) => shown(el) && !el.closest('[aria-hidden="true"], .sr-only, .maplibregl-map');
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const under = (top) => Math.max(top, seen(el).top) < inset - 0.5;
    // A strip may paint behind the status bar with padding: what counts is where its words are.
    const words = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()).some((n) => {
      const range = document.createRange();
      range.selectNodeContents(n);
      return under(range.getBoundingClientRect().top);
    });
    if (words || (el.matches('button, a[href], input') && under(seen(el).top))) problems.push(`under the status bar: ${name(el)}`);
  }
  const controls = [...document.querySelectorAll('button, a[href]')].filter(visible);
  controls.forEach((a, i) => controls.slice(i + 1).forEach((b) => {
    // A card and a link inside it that lead to the same place are one target.
    if (a.contains(b) || b.contains(a) || a.href === b.href) return;
    const x = seen(a);
    const y = seen(b);
    if (x.left + 1 < y.right && y.left + 1 < x.right && x.top + 1 < y.bottom && y.top + 1 < x.bottom) problems.push(`overlap: ${name(a)} and ${name(b)}`);
  }));
  return [...new Set(problems)];
}

async function check(user, paths) {
  const problems = [];
  for (const [width, height, top] of CASES) {
    const viewport = { width, height };
    const app = await openApp(env, { path: paths[0], user, viewport });
    const cdp = await app.context.newCDPSession(app.page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top, bottom: top ? 34 : 0, left: 0, right: 0 } });
    for (const path of paths) {
      await app.page.goto(env.origin + path);
      await app.page.waitForLoadState('load');
      await skipGuide(app.page);
      await app.page.waitForTimeout(700);
      if (path === '/feed') await app.page.locator('app-feed-card').first().waitFor({ state: 'attached', timeout: 8000 });
      for (const problem of await app.page.evaluate(audit, top)) problems.push(`${path} ${viewport.width}px inset ${top}: ${problem}`);
    }
    await app.close();
  }
  return problems;
}

test('customer screens respect the status bar, with and without a notch', { skip, timeout: 420_000 }, async () => {
  assert.deepEqual(await check(CUSTOMER_EMAIL, CUSTOMER), []);
});

test('owner screens respect the status bar, with and without a notch', { skip, timeout: 420_000 }, async () => {
  assert.deepEqual(await check(OWNER_EMAIL, OWNER), []);
});

test('the offline notice keeps its words below the status bar', { skip, timeout: 60_000 }, async () => {
  const app = await openApp(env, { path: '/feed', user: CUSTOMER_EMAIL, viewport: { width: 390, height: 844 } });
  const cdp = await app.context.newCDPSession(app.page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 59, bottom: 34, left: 0, right: 0 } });
  await app.page.goto(`${env.origin}/feed`);
  await app.page.waitForLoadState('load');
  await skipGuide(app.page);
  await app.page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await app.page.getByText('Sin conexión: algunas').waitFor({ timeout: 5000 });
  // It slides in from behind the status bar: measure where it rests.
  await app.page.waitForFunction(() => document.querySelector('app-connection-notice p').getAnimations().length === 0, null, { timeout: 5000 });
  assert.deepEqual(await app.page.evaluate(audit, 59), []);
  await app.close();
});
