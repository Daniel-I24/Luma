import { corsHeaders, isOriginAllowed } from './cors.ts';
import { type CleanupClient, removeBusinessImages } from './storage-cleanup.ts';

/** The subset of the Supabase admin client this function needs (injectable for tests). */
export interface AdminAuthClient {
  readonly auth: {
    getUser(jwt: string): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
    readonly admin: {
      deleteUser(id: string): Promise<{ error: unknown }>;
    };
  };
}

export interface HandlerDeps {
  readonly client: AdminAuthClient & CleanupClient;
  readonly allowedOrigins: readonly string[];
}

type ErrorCode = 'method_not_allowed' | 'origin_not_allowed' | 'unauthorized' | 'delete_failed';

const BEARER = /^Bearer\s+(\S+)$/i;

export function extractBearerToken(header: string | null): string | null {
  const match = header?.match(BEARER);
  return match ? match[1] : null;
}

/** The only source of identity: the caller's own JWT, validated by Supabase Auth. */
export async function resolveCallerId(
  client: AdminAuthClient,
  token: string,
): Promise<string | null> {
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
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
      const userId = token ? await resolveCallerId(deps.client, token) : null;
      if (!userId) return fail(401, 'unauthorized');

      // Pictures first: once the account is gone, nothing links them to it.
      await removeBusinessImages(deps.client, userId);

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
