#!/usr/bin/env node
/**
 * The floating chrome of the map with 1, 3 and 6 active filters, at 320 to 430 px and on a
 * tablet, with normal and 200 % text, in both themes. Fails when a filter chip overlaps another,
 * leaves the side margin, or when the filter row and the map buttons touch.
 * Offline, like check-responsive: `npx ng build --configuration screens` first.
 *
 *   node scripts/check-map-chrome.mjs [--browser=chromium]
 */
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { manyCategories, fakeSession, respond } from './screens/fixtures.mjs';
import { serve } from './screens/server.mjs';

export const MAP_VIEWPORTS = [[320, 568], [360, 640], [390, 844], [430, 932], [768, 1024]];
export const FILTER_COUNTS = [1, 3, 6];
export const MAP_THEMES = ['ciruela', 'crema'];
export const MAP_FONT_SCALES = [1, 2];
const SIDE_MARGIN = 16;
const CHIP_GAP = 8;
const SETTLE_MS = 500;

/** Pure: the problems of the measured boxes ({left, top, right, bottom} in CSS px). */
export function chromeProblems({ chips, scroller, filterButton, controls, viewportWidth }, expected) {
  const problems = [];
  const touch = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  if (chips.length !== expected) problems.push(`${chips.length} chips, expected ${expected}`);
  chips.forEach((chip, i) => {
    const next = chips[i + 1];
    if (next && Math.abs(next.left - chip.right - CHIP_GAP) > 1) problems.push(`gap ${next.left - chip.right} after chip ${i}`);
  });
  if (filterButton.left < SIDE_MARGIN - 1) problems.push(`filters button at ${filterButton.left}, outside the margin`);
  if (scroller.left < filterButton.right) problems.push('chips start under the filters button');
  if (scroller.right > viewportWidth - SIDE_MARGIN + 1) problems.push(`chips end at ${scroller.right}, outside the margin`);
  for (const control of controls) {
    if (touch(control, scroller) || touch(control, filterButton)) problems.push('a map button touches the filter row');
  }
  return problems;
}

/** Runs in the page. `scrollEnd` measures after scrolling the row to its end. */
function measure(scrollEnd) {
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  };
  const scroller = document.querySelector('[data-map-filter-chips]');
  if (scrollEnd) scroller.scrollLeft = scroller.scrollWidth;
  return {
    chips: [...scroller.querySelectorAll('.luma-chip--dismissible')].map(box),
    scroller: box(scroller),
    filterButton: box(document.querySelector('#map-filters-button')),
    controls: [...document.querySelectorAll('app-map-controls button')].map(box),
    viewportWidth: document.documentElement.clientWidth,
  };
}

async function applyFilters(page, count) {
  await page.evaluate(() => document.querySelector('#map-filters-button').click());
  await page.waitForTimeout(SETTLE_MS);
  const options = page.locator('app-map-filter-sheet .luma-chip:not(.luma-chip--disabled)');
  for (let i = 0; i < count; i++) await options.nth(i).evaluate((el) => el.click());
  await page.evaluate(() => [...document.querySelectorAll('app-map-filter-sheet app-luma-button button')].at(-1).click());
  await page.waitForTimeout(SETTLE_MS);
}

/** Every problem: "WxH font% theme filters: problem". */
export async function check({ browserChannel = 'msedge', shots = null } = {}) {
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch(browserChannel === 'chromium' ? {} : { channel: browserChannel });
  const problems = [];
  try {
    for (const [width, height] of MAP_VIEWPORTS) for (const scale of MAP_FONT_SCALES) for (const theme of MAP_THEMES) for (const count of FILTER_COUNTS) {
      const context = await browser.newContext({ viewport: { width, height }, locale: 'es-CO', reducedMotion: 'reduce' });
      await context.addInitScript(fakeSession, { theme, signedIn: true });
      await context.addInitScript((pct) => {
        localStorage.setItem('luma.tour.00000000-0000-4000-8000-000000000001.map', '1');
        document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${pct}%`; });
      }, scale * 100);
      await context.route('**/*', (route) => {
        if (route.request().url().startsWith(origin)) return route.continue();
        return new URL(route.request().url()).pathname === '/rest/v1/businesses' ? manyCategories(route) : respond(route, {});
      });
      const page = await context.newPage();
      await page.goto(`${origin}/map`);
      await page.waitForSelector('#map-filters-button', { state: 'attached' });
      await page.waitForTimeout(SETTLE_MS);
      await applyFilters(page, count);
      const tag = `${width}×${height} ${scale * 100}% ${theme} ${count}`;
      if (shots) await page.screenshot({ path: `${shots}/${width}-${scale}-${theme}-${count}.png` });
      for (const scrollEnd of [false, true]) {
        for (const problem of chromeProblems(await page.evaluate(measure, scrollEnd), count)) problems.push(`${tag}: ${problem}`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  return [...new Set(problems)];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
  check({ browserChannel: args.browser ?? 'msedge', shots: args.shots ?? null })
    .then((problems) => {
      for (const problem of problems) process.stdout.write(`${problem}\n`);
      process.stdout.write(problems.length ? `check-map-chrome: ${problems.length} problem(s)\n` : 'check-map-chrome: ok\n');
      process.exitCode = problems.length ? 1 : 0;
    })
    .catch((error) => {
      process.stderr.write(`check-map-chrome: ${error.message}\n`);
      process.exitCode = 1;
    });
}
