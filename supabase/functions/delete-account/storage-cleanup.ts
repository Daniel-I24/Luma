/** Bucket and folders written by the app (see the business_images migration). */
export const BUSINESS_IMAGES_BUCKET = 'business-images';
export const IMAGE_KINDS = ['logo', 'cover', 'menu', 'promotions'] as const;
const PAGE_SIZE = 1000;

type Result<T> = PromiseLike<{ data: T | null; error: unknown }>;

/** The subset of the service-role client the cleanup needs (injectable for tests). */
export interface CleanupClient {
  from(table: 'businesses'): {
    select(columns: 'id'): { eq(column: 'owner_id', value: string): Result<{ id: string }[]> };
  };
  readonly storage: {
    from(bucket: string): {
      list(prefix: string, options: { limit: number }): Result<{ name: string }[]>;
      remove(paths: string[]): Result<unknown>;
    };
  };
}

/**
 * Deletes every picture of the businesses the user owns, before the account
 * (and, by cascade, the businesses) are deleted. Throws on any failure so
 * the account is not deleted with its files left behind.
 */
export async function removeBusinessImages(client: CleanupClient, userId: string): Promise<number> {
  const { data: businesses, error } = await client
    .from('businesses')
    .select('id')
    .eq('owner_id', userId);
  if (error || !businesses) throw new Error('list businesses failed');
  const bucket = client.storage.from(BUSINESS_IMAGES_BUCKET);
  let removed = 0;
  for (const business of businesses) {
    for (const kind of IMAGE_KINDS) {
      const folder = `${business.id}/${kind}`;
      // Removed files leave the listing, so list again until the folder is empty.
      for (;;) {
        const listed = await bucket.list(folder, { limit: PAGE_SIZE });
        if (listed.error || !listed.data) throw new Error('list images failed');
        if (listed.data.length === 0) break;
        const paths = listed.data.map((file) => `${folder}/${file.name}`);
        const { error: removeError } = await bucket.remove(paths);
        if (removeError) throw new Error('remove images failed');
        removed += paths.length;
      }
    }
  }
  return removed;
}
