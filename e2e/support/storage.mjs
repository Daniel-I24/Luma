/**
 * The Storage calls of the profile photo: list, upload and signed URL over a
 * set of object names. `objects` is what the tests read to see what was uploaded.
 */
const OBJECT = '/storage/v1/object/';

/** Answers one Storage request, or null when it is not simulated. */
export function storage(objects, path, method) {
  if (!path.startsWith(OBJECT) || method === 'GET') return null;
  const rest = path.slice(OBJECT.length);
  if (rest.startsWith('list/')) return [200, []];
  if (rest.startsWith('sign/')) return [200, { signedURL: `/object/sign/${rest.slice('sign/'.length)}?token=e2e` }];
  if (method === 'POST') {
    objects.add(rest);
    return [200, { Id: rest, Key: rest }];
  }
  return null;
}
