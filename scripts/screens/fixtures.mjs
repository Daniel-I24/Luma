/**
 * Fixtures for scripts/screens/capture.mjs: the screens to capture, a fake
 * local session (runs in the page) and canned Supabase API answers. No real
 * project, key or user is involved; the data is invented.
 */

/** Screens in capture order: file name, path, and whether a session is restored (default true). */
export const SCREENS = [
  { name: 'welcome', signedIn: false, path: '/welcome' },
  { name: 'login', signedIn: false, path: '/auth/login' },
  { name: 'register', signedIn: false, path: '/auth/register' },
  { name: 'forgot-password', signedIn: false, path: '/auth/forgot-password' },
  { name: 'help', signedIn: false, path: '/help' },
  { name: 'legal-terms', signedIn: false, path: '/legal/terms' },
  { name: 'download', signedIn: false, path: '/download' },
  { name: 'map', path: '/map' },
  { name: 'feed', path: '/feed' },
  { name: 'promotions', path: '/promotions' },
  { name: 'ai', path: '/ai' },
  { name: 'favorites', path: '/favorites' },
  { name: 'cart', path: '/cart' },
  { name: 'orders', path: '/orders' },
  { name: 'notifications', path: '/notifications' },
  { name: 'profile', path: '/profile' },
  { name: 'account-details', path: '/account/details' },
  { name: 'account-password', path: '/account/password' },
];

const USER_ID = '00000000-0000-4000-8000-000000000001';

const PROFILE = {
  account_type: 'customer',
  display_name: 'Ana',
  full_name: 'Ana Prueba',
  phone: '3001234567',
  onboarding_seen_version: 99,
  residence_department: 'Nariño',
  residence_city: 'Pasto',
  residence_dane_code: '52001',
  residence_neighborhood: 'Centro',
  avatar_path: null,
  show_avatar_to_business: false,
};

/**
 * Runs in the page before the app (Playwright addInitScript): theme, entry
 * already seen, and (signed-in screens) a session for the invented project that the client
 * restores from localStorage without any network call.
 */
export function fakeSession({ theme, signedIn }) {
  const base64url = (value) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: '00000000-0000-4000-8000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'ana@example.test',
    email_confirmed_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
  };
  const claims = { sub: user.id, role: 'authenticated', aud: 'authenticated', exp: now + 86400, aal: 'aal1' };
  const session = {
    access_token: `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(claims)}.screens`,
    token_type: 'bearer',
    expires_in: 86400,
    expires_at: now + 86400,
    refresh_token: 'screens',
    user,
  };
  localStorage.setItem('luma-theme', theme);
  localStorage.setItem('luma-entry-seen', '1');
  if (signedIn) localStorage.setItem('sb-screens-auth-token', JSON.stringify(session));
}

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

/** Answers a request that left the local server. */
export function respond(route) {
  const url = new URL(route.request().url());
  if (url.hostname !== 'screens.invalid') return route.abort();
  if (url.pathname === '/auth/v1/user') return json(route, { id: USER_ID, email: 'ana@example.test' });
  if (url.pathname === '/rest/v1/profiles') {
    const single = (route.request().headers().accept ?? '').includes('vnd.pgrst.object');
    return json(route, single ? PROFILE : [PROFILE]);
  }
  if (url.pathname.startsWith('/rest/v1/')) return json(route, []);
  return route.abort();
}
