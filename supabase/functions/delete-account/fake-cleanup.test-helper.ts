import type { CleanupClient } from './storage-cleanup.ts';

export interface FakeStorageOptions {
  /** Business ids owned by each user. */
  readonly businesses?: Record<string, string[]>;
  /** File names per folder, keyed "{bucket}/{business}/{kind}". */
  readonly files?: Record<string, string[]>;
  readonly failRemove?: boolean;
}

/** In-memory businesses table and Storage buckets for the tests; removed = "{bucket}/{path}". */
export function fakeCleanup(options: FakeStorageOptions = {}) {
  const files = structuredClone(options.files ?? {});
  const removed: string[] = [];
  const client: CleanupClient = {
    from: () => ({
      select: () => ({
        eq: (_column, userId) =>
          Promise.resolve({
            data: (options.businesses?.[userId] ?? []).map((id) => ({ id })),
            error: null,
          }),
      }),
    }),
    storage: {
      from: (bucket) => ({
        list: (prefix, { limit }) =>
          Promise.resolve({
            data: (files[`${bucket}/${prefix}`] ?? []).slice(0, limit).map((name) => ({ name })),
            error: null,
          }),
        remove: (paths) => {
          if (options.failRemove)
            return Promise.resolve({ data: null, error: new Error('storage down') });
          for (const path of paths) {
            const folder = `${bucket}/${path.slice(0, path.lastIndexOf('/'))}`;
            files[folder] = (files[folder] ?? []).filter((name) => `${bucket}/${path}` !== `${folder}/${name}`);
            removed.push(`${bucket}/${path}`);
          }
          return Promise.resolve({ data: paths, error: null });
        },
      }),
    },
  };
  return { client, removed };
}
