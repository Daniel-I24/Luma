/** Fakes and request builders shared by the handler tests. */
import { allowedOriginsFrom } from '../_shared/cors.ts';
import { type FakeStorageOptions, fakeCleanup } from './fake-cleanup.test-helper.ts';
import { type AdminAuthClient, createHandler } from './handler.ts';

export const APP_ORIGIN = 'http://localhost:4200';
export const VALID_TOKEN = 'valid-token';
export const CALLER_ID = 'caller-id';
/** Pinned clock: 2026-10-18 12:00 UTC. */
export const NOW = Date.parse('2026-10-18T12:00:00Z');
export const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

export interface FakeOptions extends FakeStorageOptions {
  readonly deleteError?: unknown;
  readonly throwOnGetUser?: boolean;
  /** last_sign_in_at of the caller (default: one minute ago); null = never. */
  readonly signedInAt?: string | null;
}

function fakeClient(options: FakeOptions = {}) {
  const deleted: string[] = [];
  const storage = fakeCleanup(options);
  const auth: AdminAuthClient = {
    auth: {
      getUser: (jwt) => {
        if (options.throwOnGetUser) return Promise.reject(new Error('network down'));
        return Promise.resolve(
          jwt === VALID_TOKEN
            ? {
                data: {
                  user: {
                    id: CALLER_ID,
                    last_sign_in_at:
                      options.signedInAt === undefined ? minutesAgo(1) : options.signedInAt,
                  },
                },
                error: null,
              }
            : { data: { user: null }, error: new Error('invalid JWT') },
        );
      },
      admin: {
        deleteUser: (id) => {
          deleted.push(id);
          return Promise.resolve({ error: options.deleteError ?? null });
        },
      },
    },
  };
  return { client: { ...auth, ...storage.client }, deleted, removed: storage.removed };
}

export function request(
  method: string,
  headers: Record<string, string> = {},
  body?: string,
): Request {
  return new Request('http://localhost/functions/v1/delete-account', {
    method,
    headers: { Origin: APP_ORIGIN, ...headers },
    body,
  });
}

export function handlerFor(options: FakeOptions = {}) {
  const fake = fakeClient(options);
  const handler = createHandler({
    client: fake.client,
    allowedOrigins: allowedOriginsFrom(`${APP_ORIGIN}, https://luma.app`),
    now: () => NOW,
  });
  return { handler, deleted: fake.deleted, removed: fake.removed };
}
