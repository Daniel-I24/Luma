/**
 * Screenshots of every reachable screen at 360, 412 and 768 px in the four
 * themes, for the screen-by-screen review (docs/brand/screen-review.md).
 * Offline by design: it serves the `screens` build (environment.screens.ts,
 * never src/environments/environment.ts), signs in a fake local session and
 * answers the Supabase API with fixtures (scripts/screens/fixtures.mjs);
 * every other request is aborted. Output: docs/screens/ (gitignored).
 *
 *   npx ng build --configuration screens
 *   node scripts/screens/capture.mjs [--browser=msedge|chrome] [--only=map,feed]
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { SCREENS, fakeSession, respond } from './fixtures.mjs';
import { serve } from './server.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = join(ROOT, 'docs', 'screens');
const WIDTHS = [360, 412, 768];
const THEMES = ['ciruela', 'crema'];
const HEIGHT = 800;
const SETTLE_MS = 900;

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const only = args.only ? new Set(args.only.split(',')) : null;

/** One browser context (theme, width, session) and its screens. */
async function capture(browser, origin, { theme, width, signedIn }, screens) {
  const context = await browser.newContext({ viewport: { width, height: HEIGHT }, locale: 'es-CO' });
  await context.addInitScript(fakeSession, { theme, signedIn });
  await context.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : respond(route)));
  const page = await context.newPage();
  for (const screen of screens) {
    await page.goto(origin + screen.path);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: join(OUT, `${screen.name}-${width}-${theme}.png`), fullPage: true });
  }
  await context.close();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: args.browser ?? 'msedge' });
  try {
    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        for (const signedIn of [false, true]) {
          const screens = SCREENS.filter((s) => (s.signedIn ?? true) === signedIn && !s.owner && (!only || only.has(s.name)));
          if (screens.length) await capture(browser, origin, { theme, width, signedIn }, screens);
        }
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  process.stdout.write(`screens: written to ${OUT}\n`);
}

main().catch((error) => {
  process.stderr.write(`screens: ${error.message}\n`);
  process.exit(1);
});
