#!/usr/bin/env node
/**
 * Every main screen at every size: 320×568, 360×640, 390×844, 412×915,
 * 600×960, 768×1024, 1024×768 and 1280×800, with the normal text size and
 * with Android's largest font (root font at 200 %). Fails on:
 *   - horizontal scroll of the page;
 *   - text cut sideways (an element with its own text that overflows its box
 *     while hiding the overflow: ellipsis, clip);
 *   - a control smaller than 44 × 44 px (inline links in a sentence and
 *     visually hidden inputs excepted; a checkbox or radio counts its label).
 * Offline: the `screens` build and the fixtures of scripts/screens (no real
 * backend). Browser: the system Edge locally, Chromium in CI
 * (`npx playwright-core install chromium`).
 *
 *   npx ng build --configuration screens
 *   node scripts/check-responsive.mjs [--browser=chromium] [--only=map,owner-menu]
 */
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { SCREENS, fakeSession, respond } from './screens/fixtures.mjs';
import { serve } from './screens/server.mjs';

export const VIEWPORTS = [[320, 568], [360, 640], [390, 844], [412, 915], [600, 960], [768, 1024], [1024, 768], [1280, 800]];
export const FONT_SCALES = [1, 2];
const SETTLE_MS = 700;
export const MIN_TARGET = 44;

/** Runs in the page: the problems of what is on screen now. */
export function audit(minTarget) {
  const problems = [];
  const doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth + 1) problems.push(`horizontal scroll (${doc.scrollWidth} > ${doc.clientWidth})`);
  const box = (el) => el.getBoundingClientRect();
  const shown = (el) => {
    const r = box(el);
    const s = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0;
  };
  const label = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const text = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `<${el.tagName.toLowerCase()}${id}> "${text}"`;
  };
  for (const el of document.querySelectorAll('body *')) {
    const ownText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    if (!ownText || !shown(el)) continue;
    const s = getComputedStyle(el);
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) problems.push(`text cut ${label(el)}`);
  }
  const controls = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch], [role=radio], summary';
  for (const el of document.querySelectorAll(controls)) {
    const s = getComputedStyle(el);
    if (el.matches('a') && s.display === 'inline') continue;
    let target = el;
    if (el.matches('input[type=checkbox], input[type=radio]')) target = el.closest('label') ?? el;
    if (!shown(target)) continue;
    const r = box(target);
    if (r.width < minTarget - 0.5 || r.height < minTarget - 0.5) problems.push(`small target ${Math.round(r.width)}×${Math.round(r.height)} ${label(el)}`);
  }
  return [...new Set(problems)];
}

/** Every problem: "screen @ WxH font%: problem". */
export async function check({ browserChannel = 'msedge', only = null } = {}) {
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch(browserChannel === 'chromium' ? {} : { channel: browserChannel });
  const problems = [];
  try {
    for (const [width, height] of VIEWPORTS) {
      for (const scale of FONT_SCALES) {
        for (const group of [false, true].flatMap((signedIn) => [false, true].map((owner) => ({ signedIn, owner })))) {
          const screens = SCREENS.filter((s) => (s.signedIn ?? true) === group.signedIn && !!s.owner === group.owner && (!only || only.has(s.name)));
          if (!screens.length) continue;
          const context = await browser.newContext({ viewport: { width, height }, locale: 'es-CO', reducedMotion: 'reduce' });
          await context.addInitScript(fakeSession, { theme: 'sky', signedIn: group.signedIn });
          if (scale !== 1) await context.addInitScript((pct) => {
            document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${pct}%`; });
          }, scale * 100);
          await context.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : respond(route, group)));
          const page = await context.newPage();
          for (const screen of screens) {
            await page.goto(origin + screen.path);
            await page.waitForTimeout(SETTLE_MS);
            for (const problem of await page.evaluate(audit, MIN_TARGET)) problems.push(`${screen.name} @ ${width}×${height} ${scale * 100}%: ${problem}`);
          }
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
  check({ browserChannel: args.browser ?? 'msedge', only: args.only ? new Set(args.only.split(',')) : null })
    .then((problems) => {
      for (const problem of problems) process.stdout.write(`${problem}\n`);
      process.stdout.write(problems.length ? `check-responsive: ${problems.length} problem(s)\n` : 'check-responsive: ok\n');
      process.exitCode = problems.length ? 1 : 0;
    })
    .catch((error) => {
      process.stderr.write(`check-responsive: ${error.message}\n`);
      process.exitCode = 1;
    });
}
