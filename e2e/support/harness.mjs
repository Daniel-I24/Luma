/**
 * Runs the `screens` build in a real browser (Edge locally, Chromium in CI:
 * E2E_BROWSER=chromium) against simulated services: Supabase (backend.mjs),
 * Realtime (realtime.mjs) and a Wompi sandbox page. Any console error, page
 * error, request to the network or request the backend cannot answer is a
 * problem the test asserts to be empty.
 */
import { chromium } from 'playwright-core';
import { serve } from '../../scripts/screens/server.mjs';
import { createBackend } from './backend.mjs';
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
  const browser = await chromium.launch(channel === 'chromium' ? {} : { channel });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    browser,
    close: async () => {
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

/** A browser context of the app: `user` (an email of the backend) starts signed in. */
export async function openApp(env, { path = '/', user = null, payments = false, theme = 'ciruela', realMap = false, viewport = { width: 390, height: 844 } } = {}) {
  const context = await env.browser.newContext({ viewport, locale: 'es-CO' });
  const realtime = createRealtime();
  const backend = createBackend({ origin: env.origin, payments, emit: (table, record) => realtime.emit(table, record) });
  const problems = [];
  const session = user ? backend.sessionFor(user) : null;
  await context.addInitScript(({ session, theme }) => {
    localStorage.setItem('luma-theme', theme);
    localStorage.setItem('luma-entry-seen', '1');
    localStorage.setItem('luma.welcome.v1', 'seen');
    if (session) localStorage.setItem('sb-screens-auth-token', JSON.stringify(session));
  }, { session, theme });
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
    return route.fulfill({
      status,
      headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...headers },
      contentType: 'application/json',
      body: status === 204 || json === undefined ? '' : JSON.stringify(json),
    });
  });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text().slice(0, 200)}`);
  });
  page.on('pageerror', (error) => problems.push(`page error: ${error.message.slice(0, 200)}`));
  await page.goto(env.origin + path);
  return {
    page,
    backend,
    realtime,
    context,
    /** Everything that went wrong, for `assert.deepEqual(app.problems(), [])`. */
    problems: () => [...problems, ...backend.unhandled.map((r) => `not simulated: ${r}`)],
    close: () => context.close(),
  };
}

/** Closes the first-visit guide of a screen if it shows up (it appears a moment after the screen). */
export async function skipGuide(page) {
  const skip = page.getByRole('button', { name: 'Saltar' });
  await skip.waitFor({ timeout: 2000 }).then(() => skip.click()).catch(() => undefined);
}
