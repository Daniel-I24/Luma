/**
 * Simulated Supabase for the e2e tests: Auth (sign-up with a code, password
 * sign-in), PostgREST over in-memory tables (rest.mjs), the RPCs and Edge
 * Functions of rpc.mjs. Every request it cannot answer is recorded in
 * `unhandled`, and the test fails on it: nothing is answered by guess.
 */
import { randomUUID } from 'node:crypto';
import { CODE, CUSTOMER_EMAIL, CUSTOMER_ID, OWNER_EMAIL, OWNER_ID, PASSWORD, newProfile, seed } from './data.mjs';
import { remove, select, update } from './rest.mjs';
import { FUNCTIONS, RPC } from './rpc.mjs';

/** Tables answered from data that is derived from others. */
const VIEWS = {
  business_orders: (db) => db.orders.map((o) => ({ ...o, customer_label: 'Cliente', customer_avatar_path: null })),
  business_order_items: (db) => db.order_items,
};
/** Embedded relations: `alias:table(cols)` → one row or many. */
const RELATIONS = {
  businesses: (db, row) => db.businesses.find((b) => b.id === row.business_id) ?? null,
  order_items: (db, row) => db.order_items.filter((i) => i.order_id === row.id),
  menu_items: (db, row) => db.menu_items.find((m) => m.id === row.menu_item_id) ?? null,
};

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function createBackend({ origin, payments = false, emit = () => undefined } = {}) {
  const db = seed();
  const users = new Map([OWNER_EMAIL, CUSTOMER_EMAIL].map((email) => [email,
    { id: email === OWNER_EMAIL ? OWNER_ID : CUSTOMER_ID, email, password: PASSWORD, confirmed: true, metadata: {} }]));
  const unhandled = [];

  const session = (user) => {
    const now = Math.floor(Date.now() / 1000);
    const claims = { sub: user.id, role: 'authenticated', aud: 'authenticated', exp: now + 3600, aal: 'aal1', email: user.email };
    return {
      access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.e2e`, token_type: 'bearer', expires_in: 3600,
      expires_at: now + 3600, refresh_token: `refresh-${user.id}`, user: authUser(user),
    };
  };
  const authUser = (user) => ({
    id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email,
    email_confirmed_at: user.confirmed ? new Date().toISOString() : null, user_metadata: user.metadata, app_metadata: {},
    identities: [{ id: user.id, provider: 'email' }], created_at: new Date().toISOString(),
  });
  const byToken = (headers) => {
    const token = (headers.authorization ?? '').replace(/^Bearer /, '').split('.')[1];
    try {
      const sub = JSON.parse(Buffer.from(token ?? '', 'base64url').toString()).sub;
      return [...users.values()].find((u) => u.id === sub) ?? null;
    } catch {
      return null;
    }
  };

  function auth(path, method, body, url, headers) {
    if (path === '/auth/v1/signup') {
      const user = { id: randomUUID(), email: body.email, password: body.password, confirmed: false, metadata: body.data ?? {} };
      users.set(body.email, user);
      return [200, authUser(user)];
    }
    if (path === '/auth/v1/verify') {
      const user = users.get(body.email);
      if (!user || body.token !== CODE) return [403, { code: 'otp_expired', msg: 'Token has expired or is invalid' }];
      user.confirmed = true;
      const m = user.metadata;
      if (!db.profiles.some((p) => p.id === user.id)) db.profiles.push({ ...newProfile(user.id, m.account_type ?? 'customer', m.full_name ?? 'Nueva'), full_name: m.full_name, phone: m.phone, onboarding_seen_version: 0 });
      return [200, session(user)];
    }
    if (path === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'refresh_token') {
        const user = [...users.values()].find((u) => `refresh-${u.id}` === body.refresh_token);
        return user ? [200, session(user)] : [400, { error: 'invalid_grant' }];
      }
      const user = users.get(body.email);
      if (!user || user.password !== body.password) return [400, { error: 'invalid_grant', code: 'invalid_credentials', error_description: 'Invalid login credentials' }];
      if (!user.confirmed) return [400, { error: 'invalid_grant', code: 'email_not_confirmed', error_description: 'Email not confirmed' }];
      return [200, session(user)];
    }
    if (path === '/auth/v1/user' && method === 'GET') {
      const user = byToken(headers);
      return user ? [200, authUser(user)] : [401, { msg: 'invalid JWT' }];
    }
    if (path === '/auth/v1/logout') return [204, null];
    if (path === '/auth/v1/resend') return [200, {}];
    return null;
  }

  function rest(table, method, params, body, single, ctx) {
    const rows = VIEWS[table]?.(db) ?? db[table];
    if (!rows) return null;
    if (method === 'GET' || method === 'HEAD') {
      const found = select(rows, params).map((row) => embed(row, params.get('select') ?? ''));
      if (single) return found.length === 1 ? [200, found[0]] : [406, { code: 'PGRST116', message: 'no rows' }];
      return [200, found, { 'content-range': `0-${Math.max(found.length - 1, 0)}/${found.length}` }];
    }
    if (method === 'POST') {
      const added = (Array.isArray(body) ? body : [body]).map((row) => ({ id: randomUUID(), created_at: new Date().toISOString(), user_id: ctx.userId, ...row }));
      db[table].push(...added);
      return [201, single ? added[0] : added];
    }
    if (method === 'PATCH') return [200, single ? update(rows, params, body)[0] ?? null : update(rows, params, body)];
    if (method === 'DELETE') return [200, remove(db[table], params)];
    return null;
  }

  function embed(row, columns) {
    const out = { ...row };
    for (const [, alias, table] of columns.matchAll(/(?:(\w+):)?(\w+)(?:!\w+)?\(/g)) {
      if (RELATIONS[table]) out[alias ?? table] = RELATIONS[table](db, row);
    }
    return out;
  }

  /** Answers one request: [status, body, headers?], recording what it cannot answer. */
  function answer({ method, url, headers, body }) {
    const path = url.pathname;
    const user = byToken(headers);
    const ctx = { userId: user?.id ?? null, payments, origin, emit };
    let result = null;
    if (path.startsWith('/auth/v1/')) result = auth(path, method, body, url, headers);
    else if (path.startsWith('/rest/v1/rpc/')) {
      const fn = RPC[path.slice('/rest/v1/rpc/'.length)];
      const value = fn?.(db, body ?? {}, ctx);
      result = fn ? (value && typeof value === 'object' && 'error' in value && !Array.isArray(value)
        ? [400, { code: 'P0001', message: value.error }] : [200, value ?? null]) : null;
    } else if (path.startsWith('/rest/v1/')) {
      const single = (headers.accept ?? '').includes('vnd.pgrst.object');
      result = rest(path.slice('/rest/v1/'.length), method, url.searchParams, body, single, ctx);
    } else if (path.startsWith('/functions/v1/')) {
      const fn = FUNCTIONS[path.slice('/functions/v1/'.length)];
      const out = fn?.(db, body ?? {}, ctx);
      result = out ? [out.status, out.body] : null;
    }
    if (!result) unhandled.push(`${method} ${path}${url.search}`);
    return result ?? [404, { message: 'not simulated' }];
  }

  /** A session of an existing user (a test that starts signed in). */
  const sessionFor = (email) => session(users.get(email));
  /** What another phone does: an RPC as that user (e.g. the owner accepting an order). */
  const act = (email, name, args) => RPC[name](db, args, { userId: users.get(email).id, payments, origin, emit });

  return { db, users, unhandled, answer, sessionFor, act };
}
