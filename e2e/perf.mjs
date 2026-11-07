/**
 * Frame rate of the main interactions with the CPU slowed down 4 times (a mid-range
 * phone), on the `screens` build with the simulated backend and the real map tiles.
 * Each scenario runs RUNS times in a fresh context; a frame is counted with
 * requestAnimationFrame while the interaction happens.
 *   npx ng build --configuration screens && node e2e/perf.mjs
 * Prints one table: median fps, worst run, p95 frame time and frames over 50 ms.
 */
import { BUSINESS_ID, CUSTOMER_EMAIL } from './support/data.mjs';
import { openApp, skipGuide, startBrowser } from './support/harness.mjs';

const RUNS = Number(process.env.PERF_RUNS ?? 3);
const CPU_SLOWDOWN = 4;
const LONG_FRAME_MS = 50;

/** Starts counting frames in the page; `stop()` returns their durations in ms. */
async function frames(page, interact) {
  await page.evaluate(() => {
    const times = [];
    let last = performance.now();
    let running = true;
    const tick = (now) => {
      times.push(now - last);
      last = now;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    globalThis.__perfStop = () => {
      running = false;
      return times.slice(1);
    };
  });
  await interact();
  return page.evaluate(() => globalThis.__perfStop());
}

const swipe = async (page, from, to, steps = 12) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
};

const SCENARIOS = {
  'Feed: scroll': {
    path: '/feed',
    run: async (page) => {
      for (let i = 0; i < 4; i++) {
        await page.mouse.wheel(0, 700);
        await page.waitForTimeout(450);
      }
    },
  },
  'Map: pan and zoom': {
    path: '/map',
    settle: 5000,
    run: async (page) => {
      await swipe(page, { x: 200, y: 450 }, { x: 80, y: 300 });
      await swipe(page, { x: 120, y: 300 }, { x: 300, y: 520 });
      await page.mouse.move(200, 420);
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, -300);
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(600);
    },
  },
  'Tabs: map, feed, orders, profile': {
    path: '/feed',
    run: async (page) => {
      for (const name of ['Pedidos', 'Perfil', 'Descubrir', 'Mapa', 'Descubrir']) {
        await page.getByRole('link', { name, exact: true }).first().click();
        await page.waitForTimeout(700);
      }
    },
  },
  'Business: scroll the menu': {
    path: `/businesses/${BUSINESS_ID}`,
    run: async (page) => {
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(400);
      }
    },
  },
};

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const percentile = (values, p) =>
  [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))];

async function measure(env, scenario) {
  const app = await openApp(env, { path: scenario.path, user: CUSTOMER_EMAIL, realMap: true });
  const { page } = app;
  await page.waitForLoadState('load');
  await skipGuide(page);
  await page.waitForTimeout(scenario.settle ?? 1500);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  const times = await frames(page, () => scenario.run(page));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await app.close();
  const total = times.reduce((sum, t) => sum + t, 0);
  return {
    fps: (times.length * 1000) / total,
    p95: percentile(times, 0.95),
    long: times.filter((t) => t > LONG_FRAME_MS).length,
  };
}

const env = await startBrowser();
const rows = [];
try {
  for (const [name, scenario] of Object.entries(SCENARIOS)) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await measure(env, scenario));
    rows.push({
      scenario: name,
      'fps (median)': median(runs.map((r) => r.fps)).toFixed(1),
      'fps (worst)': Math.min(...runs.map((r) => r.fps)).toFixed(1),
      'p95 frame ms': median(runs.map((r) => r.p95)).toFixed(1),
      'frames > 50 ms': runs.map((r) => r.long).join(' / '),
    });
  }
} finally {
  await env.close();
}
console.table(rows);
