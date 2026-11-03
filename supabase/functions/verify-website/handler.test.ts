import { assertEquals } from '@std/assert';

import { type CallerApi, createHandler } from './handler.ts';
import { isBlockedAddress } from './ip-address.ts';
import { dohResolver, runtimeResolver } from './resolver.ts';
import { containsCode, fetchVerificationFile, MAX_BYTES, verificationUrl } from './ssrf.ts';

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

Deno.test('SSRF: IPv6 is read as its 16 bytes, so no spelling of a private address gets through', () => {
  const blocked = [
    '::ffff:7f00:1', '::ffff:127.0.0.1', '::ffff:a9fe:a9fe', '::7f00:1', '::127.0.0.1', '::', '::1', '[::1]',
    '0:0:0:0:0:0:0:1', '64:ff9b::7f00:1', '64:ff9b::808:808', '2002:7f00:1::', '2002:c0a8:101::1', '2002:a9fe:a9fe::',
    'fe80::1', 'fe80::1%eth0', 'fc00::1', 'fd12:3456::1', 'ff02::1', '2001:db8::1', '2001:0:4136:e378::1', '3fff::1',
    '1:2:3:4:5:6:7:8:9', 'gggg::1', '1::2::3', '::ffff:999.0.0.1', '100::1',
  ];
  assertEquals(blocked.filter((ip) => !isBlockedAddress(ip)), []);
  const allowed = ['2606:4700::1111', '2a00:1450:4001:80b::200e', '2002:808:808::1', '2800:3f0:4005:40b::2003'];
  assertEquals(allowed.filter((ip) => isBlockedAddress(ip)), []);
});

Deno.test('DNS: without Deno.resolveDns the resolver asks DNS over HTTPS (A and AAAA only, with a time limit)', async () => {
  const asked: { url: string; accept: string | null; signal: boolean }[] = [];
  const fetchFn = (url: string, init: RequestInit) => {
    asked.push({ url, accept: new Headers(init.headers).get('accept'), signal: !!init.signal });
    const type = new URL(url).searchParams.get('type');
    const answer = type === 'A'
      ? [{ type: 5, data: 'alias.example.' }, { type: 1, data: '93.184.215.14' }]
      : [{ type: 28, data: '2606:2800:21f:cb07:6820:80da:af6b:8b2c' }, { type: 1, data: 'not-an-aaaa' }];
    return Promise.resolve(Response.json({ Status: 0, Answer: answer }));
  };
  const resolve = runtimeResolver(undefined, fetchFn);
  assertEquals(await resolve('cafe.co'), ['93.184.215.14', '2606:2800:21f:cb07:6820:80da:af6b:8b2c']);
  assertEquals(asked.map((a) => new URL(a.url).searchParams.get('type')), ['A', 'AAAA']);
  assertEquals(asked.every((a) => a.url.startsWith('https://cloudflare-dns.com/dns-query?') && a.accept === 'application/dns-json' && a.signal), true);
  assertEquals(await dohResolver(() => Promise.reject(new Error('down')))('cafe.co'), []);
  assertEquals(await dohResolver(() => Promise.resolve(Response.json({ Status: 3 })))('nope.co'), []);
});

Deno.test('DNS: the runtime resolver is used when it exists; one that is not supported falls back to DNS over HTTPS', async () => {
  const native = (_host: string, type: 'A' | 'AAAA') => Promise.resolve(type === 'A' ? ['1.1.1.1'] : []);
  assertEquals(await runtimeResolver(native, () => Promise.reject(new Error('unused')))('cafe.co'), ['1.1.1.1']);
  const unsupported = () => Promise.reject(new TypeError('Deno.resolveDns is not supported'));
  const doh = () => Promise.resolve(Response.json({ Status: 0, Answer: [{ type: 1, data: '8.8.4.4' }] }));
  assertEquals(await runtimeResolver(unsupported, doh)('cafe.co'), ['8.8.4.4']);
  const notFound = () => Promise.reject(Object.assign(new Error('no record'), { name: 'NotFound' }));
  assertEquals(await runtimeResolver(notFound, doh)('missing.co'), []);
});
