import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { CUSTOMER_EMAIL } from './support/data.mjs';
import { openApp, startBrowser } from './support/harness.mjs';

/**
 * The network really goes away (context.setOffline): the "Sin conexión" strip pushes every screen
 * down instead of covering it, and gives the space back. Notch emulation needs the DevTools
 * protocol, so WebKit runs only the cases without one.
 */
const WEBKIT = process.env.E2E_BROWSER === 'webkit';
const SCREENS = ['/feed', '/map', '/orders', '/profile'];
const CASES = [[320, 568, 59], [320, 568, 0], [390, 844, 59], [390, 844, 0]].filter(([, , top]) => !WEBKIT || top === 0);
const STRIP = 'Sin conexión: algunas';

let env;
before(async () => (env = await startBrowser()));
after(() => env?.close());

async function open(width, height, top, path = SCREENS[0]) {
  const app = await openApp(env, { path, user: CUSTOMER_EMAIL, viewport: { width, height } });
  if (!WEBKIT) {
    const cdp = await app.context.newCDPSession(app.page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top, bottom: top ? 34 : 0, left: 0, right: 0 } });
  }
  return app;
}

async function show(app, path) {
  await app.page.goto(env.origin + path);
  await app.page.waitForLoadState('load');
  await app.settle();
  if (path === '/feed') await app.page.locator('app-feed-card').first().waitFor({ state: 'attached', timeout: 8000 });
}

/** Runs in the page: how far down screens start now. */
const insetTop = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--inset-top'));

/** Runs in the page: words and controls the strip is painted over. */
function covered() {
  const bottom = document.querySelector('app-connection-notice p').getBoundingClientRect().bottom;
  const found = [];
  for (const el of document.querySelectorAll('body *')) if (el.scrollTop) el.scrollTop = 0;
  const clip = (el, top) => {
    let result = top;
    let box = el.getBoundingClientRect().bottom;
    for (let up = el.parentElement; up; up = up.parentElement) {
      const s = getComputedStyle(up);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const c = up.getBoundingClientRect();
      result = Math.max(result, c.top);
      box = Math.min(box, c.bottom);
    }
    return box - result > 1 ? result : Infinity;
  };
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('app-connection-notice, [aria-hidden="true"], .sr-only, .maplibregl-map')) continue;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (s.visibility === 'hidden' || Number(s.opacity) === 0 || r.width < 1 || r.height < 1 || r.top >= innerHeight) continue;
    const words = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()).map((n) => {
      const range = document.createRange();
      range.selectNodeContents(n);
      return range.getBoundingClientRect().top;
    });
    const tops = el.matches('button, a[href], input') ? [...words, r.top] : words;
    if (tops.some((top) => clip(el, top) < bottom - 0.5)) found.push(`<${el.tagName.toLowerCase()}> "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}"`);
  }
  return [...new Set(found)];
}

test('offline, the strip pushes Discover, Map, Orders and Profile down, and gives the space back', { timeout: 300_000 }, async () => {
  const problems = [];
  for (const [width, height, top] of CASES) {
    const app = await open(width, height, top);
    for (const path of SCREENS) {
      const where = `${path} ${width}px inset ${top}`;
      await show(app, path);
      assert.equal(Math.round(await app.page.evaluate(insetTop)), top, `${where}: starts at the status bar`);
      await app.context.setOffline(true);
      await app.page.getByText(STRIP).waitFor({ timeout: 5000 });
      await app.page.waitForFunction(() => {
        const strip = document.querySelector('app-connection-notice p').getBoundingClientRect();
        return Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--inset-top')) - strip.height) < 0.5;
      }, null, { timeout: 5000 });
      assert.ok((await app.page.evaluate(insetTop)) > top, `${where}: the screen moved down`);
      for (const found of await app.page.evaluate(covered)) problems.push(`${where}: under the strip: ${found}`);
      await app.context.setOffline(false);
      await app.page.getByText(STRIP).waitFor({ state: 'detached', timeout: 5000 });
      await app.page.waitForFunction((value) => Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--inset-top')) - value) < 0.5, top, { timeout: 5000 });
    }
    await app.close();
  }
  assert.deepEqual(problems, []);
});

/** Runs in the page: every value of the inset, frame by frame, for almost a second. */
const frames = () => new Promise((done) => {
  const values = [];
  const start = performance.now();
  const tick = () => {
    values.push(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--inset-top')));
    if (performance.now() - start < 900) requestAnimationFrame(tick);
    else done(values);
  };
  tick();
});

for (const [motion, glides] of [['no-preference', true], ['reduce', false]]) {
  test(`the screen ${glides ? 'glides' : 'moves at once'} with prefers-reduced-motion: ${motion}`, { timeout: 60_000 }, async () => {
    const app = await open(390, 844, 0);
    await show(app, '/orders');
    await app.page.emulateMedia({ reducedMotion: motion });
    const sampling = app.page.evaluate(frames);
    await app.context.setOffline(true);
    const values = await sampling;
    await app.context.setOffline(false);
    const [first, last] = [values[0], values.at(-1)];
    assert.ok(last > first, `it moved: ${first} to ${last}`);
    const between = values.filter((value) => value > first + 0.5 && value < last - 0.5);
    assert.equal(between.length > 0, glides, `frames in between: ${between.length} of ${values.length}`);
    await app.close();
  });
}
