/** Fakes and request builders shared by the handler tests. */
import { allowedOriginsFrom } from './cors.ts';
import { type FakeStorageOptions, fakeCleanup } from './fake-cleanup.test-helper.ts';
import { type AdminAuthClient, createHandler } from './handler.ts';

export const APP_ORIGIN = 'http://localhost:4200';
export const VALID_TOKEN = 'valid-token';
export const CALLER_ID = 'caller-id';

export interface FakeOptions extends FakeStorageOptions {
  readonly deleteError?: unknown;
  readonly throwOnGetUser?: boolean;
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
            ? { data: { user: { id: CALLER_ID } }, error: null }
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
  });
  return { handler, deleted: fake.deleted, removed: fake.removed };
}
