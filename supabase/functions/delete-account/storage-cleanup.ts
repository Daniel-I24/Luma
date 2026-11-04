/**
 * Buckets and folders written for each business (see the business_images and
 * verification_storage migrations): "{business id}/{kind}/{file}".
 */
const BUSINESS_FOLDERS = [
  { bucket: 'business-images', kinds: ['logo', 'cover', 'menu', 'promotions', 'gallery'] },
  { bucket: 'verification-docs', kinds: ['rut', 'facade', 'other'] },
] as const;
/** Buckets and folders written for the user themself (avatars migration): "{user id}/{kind}/{file}". */
const USER_FOLDERS = [
  { bucket: 'avatars', kinds: ['avatar'] },
] as const;
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

/** Empties "{owner}/{kind}" folders of one bucket; returns how many files went. */
async function removeFolders(client: CleanupClient, bucketName: string, owners: readonly string[],
                             kinds: readonly string[]): Promise<number> {
  const bucket = client.storage.from(bucketName);
  let removed = 0;
  for (const owner of owners) {
    for (const kind of kinds) {
      const folder = `${owner}/${kind}`;
      // Removed files leave the listing, so list again until the folder is empty.
      for (;;) {
        const listed = await bucket.list(folder, { limit: PAGE_SIZE });
        if (listed.error || !listed.data) throw new Error('list files failed');
        if (listed.data.length === 0) break;
        const paths = listed.data.map((file) => `${folder}/${file.name}`);
        const { error: removeError } = await bucket.remove(paths);
        if (removeError) throw new Error('remove files failed');
        removed += paths.length;
      }
    }
  }
  return removed;
}

/**
 * Deletes every file of the user (their avatar) and of the businesses they
 * own (pictures and verification documents), before the account (and, by
 * cascade, the businesses) are deleted. Throws on any failure so the account
 * is not deleted with its files left behind.
 */
export async function removeUserFiles(client: CleanupClient, userId: string): Promise<number> {
  const { data: businesses, error } = await client
    .from('businesses')
    .select('id')
    .eq('owner_id', userId);
  if (error || !businesses) throw new Error('list businesses failed');
  const businessIds = businesses.map((business) => business.id);
  let removed = 0;
  for (const { bucket, kinds } of BUSINESS_FOLDERS) removed += await removeFolders(client, bucket, businessIds, kinds);
  for (const { bucket, kinds } of USER_FOLDERS) removed += await removeFolders(client, bucket, [userId], kinds);
  return removed;
}
