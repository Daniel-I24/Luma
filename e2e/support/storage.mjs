/**
 * The Storage calls of the profile photo: list, upload, signed URL and the
 * download of that URL, over a set of object names. `objects` is what the
 * tests read to see what was uploaded.
 */
const OBJECT = '/storage/v1/object/';
const SIGNED = 'sign/';
/** What a signed URL of an uploaded object serves: a valid 1×1 PNG (the e2e tests check flows, not pictures). */
const PICTURE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

/** Answers one Storage request, or null when it is not simulated. */
export function storage(objects, path, method) {
  if (!path.startsWith(OBJECT)) return null;
  const rest = path.slice(OBJECT.length);
  if (method === 'GET') {
    // Only an object that was uploaded can be downloaded; anything else stays "not simulated".
    if (!rest.startsWith(SIGNED) || !objects.has(rest.slice(SIGNED.length))) return null;
    return [200, PICTURE, { 'content-type': 'image/png' }];
  }
  if (rest.startsWith('list/')) return [200, []];
  if (rest.startsWith(SIGNED)) return [200, { signedURL: `/object/sign/${rest.slice(SIGNED.length)}?token=e2e` }];
  if (method === 'POST') {
    objects.add(rest);
    return [200, { Id: rest, Key: rest }];
  }
  return null;
}
