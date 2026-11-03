/**
 * Fixtures for scripts/screens/capture.mjs: the screens to capture, a fake
 * local session (runs in the page) and canned Supabase API answers. No real
 * project, key or user is involved; the data is invented.
 */

/** Screens in capture order: file name, path, and whether a session is restored (default true). */
const BUSINESS_ID = '00000000-0000-4000-8000-0000000000b1';

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
  { name: 'tutorials', path: '/tutorials' },
  { name: 'business', path: `/businesses/${BUSINESS_ID}` },
  // Luma Negocios with a business of long names and big prices (round 8, check:responsive).
  { name: 'owner-summary', owner: true, path: `/owner/${BUSINESS_ID}/summary` },
  { name: 'owner-business', owner: true, path: `/owner/${BUSINESS_ID}/business` },
  { name: 'owner-menu', owner: true, path: `/owner/${BUSINESS_ID}/menu` },
  { name: 'owner-orders', owner: true, path: `/owner/${BUSINESS_ID}/orders` },
  { name: 'owner-promotions', owner: true, path: `/owner/${BUSINESS_ID}/promotions` },
  { name: 'owner-info', owner: true, path: `/owner/${BUSINESS_ID}/business/info` },
  { name: 'owner-contact', owner: true, path: `/owner/${BUSINESS_ID}/business/contact` },
  { name: 'owner-verification', owner: true, path: `/owner/${BUSINESS_ID}/business/verification` },
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

/** A published business with the longest names the rules allow and big prices. */
const BUSINESS = {
  id: BUSINESS_ID, owner_id: USER_ID, name: 'Panadería y Pastelería Doña Rosa del Barrio San Andrés',
  description: 'Pan de yuca, empanadas de pipián y café de Nariño desde 1987.', category: 'Panadería',
  latitude: 1.2136, longitude: -77.2811, address: 'Carrera 27 No. 15-40, Barrio San Andrés, Local 2',
  phone: '+573001234567', whatsapp: null, instagram: null, facebook: null, website: null, logo_url: null, cover_url: null,
  is_active: true, verification_status: 'approved', verification_note: null, prep_minutes: 20, department: 'Nariño',
  city_dane_code: '52001', orders_paused_until: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
};
const MENU = [
  { name: 'Empanadas de pipián con ají de maní y limonada de panela', price_cop: 1250000, section: 'Especialidades de la casa para compartir en familia' },
  { name: 'Tinto', price_cop: 2000, section: 'Bebidas' },
  { name: 'Helado de paila de mora con queso', price_cop: 20000, section: 'Postres' },
].map((item, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i}`, business_id: BUSINESS_ID, description: 'Hecho cada mañana con ingredientes de la región.',
  image_url: null, is_available: true, sort_order: i, ...item,
}));
const HOURS = Array.from({ length: 7 }, (_, day) => ({ business_id: BUSINESS_ID, day_of_week: day, opens_at: '07:00:00', closes_at: '20:00:00', is_closed: false }));

/** Answers a request that left the local server; owner screens see an owner profile and their business. */
export function respond(route, { owner = false } = {}) {
  const url = new URL(route.request().url());
  if (url.hostname !== 'screens.invalid') return route.abort();
  const single = (route.request().headers().accept ?? '').includes('vnd.pgrst.object');
  const one = (row) => json(route, single ? row : [row]);
  if (url.pathname === '/auth/v1/user') return json(route, { id: USER_ID, email: 'ana@example.test' });
  if (url.pathname === '/rest/v1/profiles') return one({ ...PROFILE, account_type: owner ? 'business_owner' : 'customer' });
  if (url.pathname === '/rest/v1/businesses') return one(BUSINESS);
  if (url.pathname === '/rest/v1/menu_items') return json(route, MENU);
  if (url.pathname === '/rest/v1/business_hours') return json(route, HOURS);
  if (url.pathname.startsWith('/rest/v1/')) return json(route, single ? null : []);
  return route.abort();
}
