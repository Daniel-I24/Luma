import { assertEquals } from '@std/assert';

import { type CallerApi, createHandler } from './handler.ts';
import { containsCode, fetchVerificationFile, isBlockedAddress, MAX_BYTES, verificationUrl } from './ssrf.ts';

const ORIGIN = 'http://localhost:4200';
const BUSINESS = '6f0c1b2a-3d4e-4f50-8a9b-0c1d2e3f4a5b';
const CODE = 'LUMA-AB12CD';
const PUBLIC_IP = '93.184.216.34';

type Answer = (url: string) => Response;

type Started = Awaited<ReturnType<CallerApi['startCheck']>>;

function setup(options: { site?: string; dns?: Record<string, string[]>; answer?: Answer; start?: Started } = {}) {
  const fetched: string[] = [];
  const completed: string[] = [];
  const handler = createHandler({
    allowedOrigins: [ORIGIN],
    authenticate: (token) =>
      Promise.resolve(token === 'good'
        ? { startCheck: () => Promise.resolve(options.start ?? { verificationId: 'v1', website: options.site ?? 'https://cafe.example.co', code: CODE }) }
        : null),
    complete: (id) => {
      completed.push(id);
      return Promise.resolve(true);
    },
    resolve: (host) => Promise.resolve(options.dns?.[host] ?? [PUBLIC_IP]),
    fetchFn: (url) => {
      fetched.push(url);
      return Promise.resolve((options.answer ?? (() => new Response(`${CODE}\n`)))(url));
    },
  });
  return { handler, fetched, completed };
}
const post = (body: unknown = { business_id: BUSINESS }, token = 'good') =>
  new Request('http://localhost/functions/v1/verify-website', {
    method: 'POST',
    headers: { Origin: ORIGIN, Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

Deno.test('a file with the exact code verifies the website', async () => {
  const { handler, fetched, completed } = setup();
  assertEquals(await (await handler(post())).json(), { verified: true });
  assertEquals(fetched, ['https://cafe.example.co/.well-known/luma-verification.txt']);
  assertEquals(completed, ['v1']);
});

Deno.test('needs a JWT, a business id, and passes on the database refusals (checks used up)', async () => {
  assertEquals((await setup().handler(post(undefined, 'bad'))).status, 401);
  assertEquals((await setup().handler(post({ business_id: 'x' }))).status, 400);
  const limited = setup({ start: { error: 'too_many_checks' } });
  assertEquals((await limited.handler(post())).status, 429);
  assertEquals(limited.fetched.length, 0);
});

Deno.test('a wrong code, a missing file or a big file verify nothing', async () => {
  for (const [answer, reason] of [
    [() => new Response('LUMA-ZZZZZZ'), 'mismatch'],
    [() => new Response('no', { status: 404 }), 'not_found'],
    [() => new Response('x'.repeat(MAX_BYTES + 1)), 'too_large'],
  ] as [Answer, string][]) {
    const { handler, completed } = setup({ answer });
    assertEquals(await (await handler(post())).json(), { verified: false, reason });
    assertEquals(completed.length, 0);
  }
});

Deno.test('SSRF: private, loopback, link-local and metadata addresses are never fetched', async () => {
  for (const ip of ['10.0.0.5', '127.0.0.1', '169.254.169.254', '192.168.1.1', '172.16.0.1', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) {
    const { handler, fetched } = setup({ dns: { 'cafe.example.co': [PUBLIC_IP, ip] } });
    assertEquals(await (await handler(post())).json(), { verified: false, reason: 'blocked' }, ip);
    assertEquals(fetched.length, 0, ip);
  }
  assertEquals(isBlockedAddress('8.8.8.8'), false);
  assertEquals(isBlockedAddress('2606:4700::1111'), false);
});

Deno.test('SSRF: only https on 443 to a host name', () => {
  for (const site of ['http://cafe.co', 'https://cafe.co:8443', 'https://user:pw@cafe.co', 'https://10.0.0.1', 'https://[::1]', 'https://localhost', 'ftp://cafe.co']) {
    assertEquals(verificationUrl(site), null, site);
  }
  assertEquals(verificationUrl('https://cafe.co/menu?x=1')?.href, 'https://cafe.co/.well-known/luma-verification.txt');
});

Deno.test('redirections: at most 2, same host only, checked again each time', async () => {
  const file = new URL('https://cafe.example.co/.well-known/luma-verification.txt');
  const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });
  const twice = (url: string) => (url.endsWith('/b') ? new Response(CODE) : url.endsWith('/a') ? redirect('/b') : redirect('/a'));
  assertEquals((await fetchVerificationFile(file, () => Promise.resolve([PUBLIC_IP]), (u) => Promise.resolve(twice(u)))).kind, 'ok');
  const loop = () => redirect('/again');
  assertEquals((await fetchVerificationFile(file, () => Promise.resolve([PUBLIC_IP]), () => Promise.resolve(loop()))).kind, 'blocked');
  const away = () => redirect('https://evil.example.net/x');
  assertEquals((await fetchVerificationFile(file, () => Promise.resolve([PUBLIC_IP]), () => Promise.resolve(away()))).kind, 'blocked');
  const toHttp = () => redirect('http://cafe.example.co/x');
  assertEquals((await fetchVerificationFile(file, () => Promise.resolve([PUBLIC_IP]), () => Promise.resolve(toHttp()))).kind, 'blocked');
  // The same host resolving to a private address after the redirection (rebinding attempt) is refused.
  let calls = 0;
  const rebinding = () => Promise.resolve(calls++ === 0 ? [PUBLIC_IP] : ['10.0.0.1']);
  assertEquals((await fetchVerificationFile(file, rebinding, () => Promise.resolve(redirect('/a')))).kind, 'blocked');
});

Deno.test('the code must be a whole line', () => {
  assertEquals(containsCode(`hola\n  ${CODE}  \n`, CODE), true);
  assertEquals(containsCode(`x${CODE}`, CODE), false);
});
