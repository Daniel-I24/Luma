import { corsHeaders, isOriginAllowed } from '../_shared/cors.ts';
import { type CleanupClient, removeBusinessFiles } from './storage-cleanup.ts';

interface CallerUser {
  readonly id: string;
  readonly last_sign_in_at?: string | null;
}

/** The subset of the Supabase admin client this function needs (injectable for tests). */
export interface AdminAuthClient {
  readonly auth: {
    getUser(jwt: string): Promise<{ data: { user: CallerUser | null }; error: unknown }>;
    readonly admin: {
      deleteUser(id: string): Promise<{ error: unknown }>;
    };
  };
}

export interface HandlerDeps {
  readonly client: AdminAuthClient & CleanupClient;
  readonly allowedOrigins: readonly string[];
  /** Clock in ms (tests pin it). */
  readonly now?: () => number;
}

/** Deleting needs a sign-in (password or code) this recent; a refreshed token is not enough. */
export const REAUTH_WINDOW_MS = 10 * 60 * 1000;

type ErrorCode =
  | 'method_not_allowed'
  | 'origin_not_allowed'
  | 'unauthorized'
  | 'reauth_required'
  | 'delete_failed';

const BEARER = /^Bearer\s+(\S+)$/i;

export function extractBearerToken(header: string | null): string | null {
  const match = header?.match(BEARER);
  return match ? match[1] : null;
}

/** The only source of identity: the caller's own JWT, validated by Supabase Auth. */
export async function resolveCaller(
  client: AdminAuthClient,
  token: string,
): Promise<CallerUser | null> {
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

export function signedInRecently(user: CallerUser, now: number): boolean {
  const at = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : Number.NaN;
  return Number.isFinite(at) && now - at <= REAUTH_WINDOW_MS;
}

export async function deleteAccount(client: AdminAuthClient, userId: string): Promise<boolean> {
  const { error } = await client.auth.admin.deleteUser(userId);
  return !error;
}

function json(status: number, body: object, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const origin = req.headers.get('Origin');
    const cors = corsHeaders(origin, deps.allowedOrigins);
    const fail = (status: number, error: ErrorCode, extra: Record<string, string> = {}) =>
      json(status, { error }, { ...cors, ...extra });

    if (!isOriginAllowed(origin, deps.allowedOrigins)) return fail(403, 'origin_not_allowed');
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', { Allow: 'POST, OPTIONS' });

    try {
      const token = extractBearerToken(req.headers.get('Authorization'));
      const caller = token ? await resolveCaller(deps.client, token) : null;
      if (!caller) return fail(401, 'unauthorized');
      if (!signedInRecently(caller, (deps.now ?? Date.now)())) return fail(403, 'reauth_required');
      const userId = caller.id;

      // Files first: once the account is gone, nothing links them to it.
      await removeBusinessFiles(deps.client, userId);

      if (!(await deleteAccount(deps.client, userId))) {
        console.error('delete-account: admin deleteUser returned an error');
        return fail(500, 'delete_failed');
      }
      return json(200, { deleted: true }, cors);
    } catch {
      console.error('delete-account: unexpected failure');
      return fail(500, 'delete_failed');
    }
  };
}
