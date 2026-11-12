/**
 * Runs the `screens` build in a real browser (Edge locally, Chromium in CI:
 * E2E_BROWSER=chromium; an emulated iPhone: E2E_BROWSER=webkit) against simulated services: Supabase (backend.mjs),
 * Realtime (realtime.mjs) and a Wompi sandbox page. Any console error, page
 * error, request to the network or request the backend cannot answer is a
 * problem the test asserts to be empty.
 */
import { chromium, devices, webkit } from 'playwright-core';
import { serve } from '../../scripts/screens/server.mjs';
import { dropRecording, keepRecordings, startRecording } from './artifacts.mjs';
import { createBackend } from './backend.mjs';
import { seenGuideKeys } from './guides.mjs';
import { settle } from './waits.mjs';
import { approvePayment } from './rpc.mjs';
import { createRealtime } from './realtime.mjs';

const SUPABASE_HOST = 'screens.invalid';
const WOMPI_HOST = 'checkout.wompi.co';
/** Map tiles: an empty style (the e2e tests check flows, not the map picture). */
const MAP_HOST = 'tiles.openfreemap.org';
const EMPTY_STYLE = JSON.stringify({ version: 8, sources: {}, layers: [] });

export async function startBrowser() {
  const channel = process.env.E2E_BROWSER ?? 'msedge';
  const server = await serve();
  const iphone = channel === 'webkit';
  const browser = iphone ? await webkit.launch() : await chromium.launch(channel === 'chromium' ? {} : { channel });
  /** Contexts not closed by their test yet: at the end, those of failed tests (support/artifacts.mjs). */
  const open = new Set();
  return {
    device: iphone ? devices['iPhone 13'] : {},
    origin: `http://127.0.0.1:${server.address().port}`,
    browser,
    open,
    close: async () => {
      await keepRecordings(open);
      await browser.close();
      server.close();
    },
  };
}

/** The simulated Wompi sandbox: "Pagar" approves the payment and returns to the redirect URL. */
function wompiPage() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Wompi sandbox simulado</title></head>
<body><main><h1>Pago de prueba (sandbox)</h1><button id="pay" type="button">Pagar con la tarjeta 4242 4242 4242 4242</button></main>
<script>
document.getElementById('pay').addEventListener('click', async () => {
  const back = new URLSearchParams(location.search).get('redirect-url');
  await fetch('/approve?order=' + new URL(back).searchParams.get('order'), { method: 'POST' });
  location.href = back + '&id=12345-1-sandbox&env=test';
});
</script></body></html>`;
}

/**
 * A browser context of the app: `user` (an email of the backend) starts signed in. The section
 * guides start as seen (support/guides.mjs) unless `guides` is true.
 */
export async function openApp(env, { path = '/', user = null, payments = false, theme = 'ciruela', realMap = false, guides = false, viewport = { width: 390, height: 844 } } = {}) {
  const context = await env.browser.newContext({ ...env.device, viewport, locale: 'es-CO' });
  env.open.add(context);
  await startRecording(context);
  const realtime = createRealtime();
  const backend = createBackend({ origin: env.origin, payments, emit: (table, record) => realtime.emit(table, record) });
  const problems = [];
  const session = user ? backend.sessionFor(user) : null;
  const seen = guides ? [] : seenGuideKeys([...backend.users.values()].map((known) => known.id));
  await context.addInitScript(({ session, theme, seen }) => {
    localStorage.setItem('luma-theme', theme);
    localStorage.setItem('luma-entry-seen', '1');
    localStorage.setItem('luma.welcome.v1', 'seen');
    for (const key of seen) localStorage.setItem(key, 'e2e');
    if (session) localStorage.setItem('sb-screens-auth-token', JSON.stringify(session));
  }, { session, theme, seen });
  await context.routeWebSocket(/\/realtime\/v1\/websocket/, realtime.route);
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.url().startsWith(env.origin)) return route.continue();
    if (url.hostname === WOMPI_HOST) {
      if (url.pathname === '/approve') {
        approvePayment(backend.db, url.searchParams.get('order'), (table, record) => realtime.emit(table, record));
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({ status: 200, contentType: 'text/html', body: wompiPage() });
    }
    if (url.hostname === MAP_HOST && realMap) return route.continue();
    if (url.hostname === MAP_HOST) return route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_STYLE });
    if (url.hostname !== SUPABASE_HOST) {
      problems.push(`network: ${request.method()} ${url.origin}${url.pathname}`);
      return route.abort();
    }
    let body = null;
    try { body = request.postDataJSON(); } catch { body = null; }
    const [status, json, headers = {}] = backend.answer({ method: request.method(), url, headers: request.headers(), body });
    // A Buffer is a file (a Storage download) with its own content-type; anything else is JSON.
    const binary = Buffer.isBuffer(json);
    return route.fulfill({
      status,
      headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...headers },
      contentType: binary ? headers['content-type'] : 'application/json',
      body: binary ? json : status === 204 || json === undefined ? '' : JSON.stringify(json),
    });
  });
  const page = await context.newPage();
  // Requests to the simulated services only: the app's own files can be served from the cache without a "finished" event.
  const inFlight = new Set();
  page.on('request', (request) => { if (!request.url().startsWith(env.origin)) inFlight.add(request); });
  for (const done of ['requestfinished', 'requestfailed']) page.on(done, (request) => inFlight.delete(request));
  page.on('console', (message) => {
    // WebKit reports a lazy import cancelled by leaving the page (to Wompi, to the next screen) as a failure.
    if (env.device.isMobile && message.text().includes('Importing a module script failed')) return;
    if (message.type() === 'error') problems.push(`console: ${message.text().slice(0, 200)}`);
  });
  page.on('pageerror', (error) => {
    if (!env.device.isMobile || !error.message.includes('Importing a module script failed')) problems.push(`page error: ${error.message.slice(0, 200)}`);
  });
  await page.goto(env.origin + path);
  return {
    page,
    backend,
    realtime,
    context,
    /** Everything that went wrong, for `assert.deepEqual(app.problems(), [])`. */
    problems: () => [...problems, ...backend.unhandled.map((r) => `not simulated: ${r}`)],
    /** Waits until the screen is still (see `settle`). */
    settle: () => settle(page, inFlight),
    close: async () => {
      env.open.delete(context);
      await dropRecording(context);
      await context.close();
    },
  };
}
