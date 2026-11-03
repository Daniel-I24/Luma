/** Firebase Cloud Messaging HTTP v1 with a service account (RS256 JWT, OAuth2). */

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface ServiceAccount {
  readonly projectId: string;
  readonly clientEmail: string;
  readonly privateKey: string;
}

export type SendResult = 'sent' | 'invalid_token' | 'failed';

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** FCM_SERVICE_ACCOUNT (the JSON key file as one secret); null when missing or malformed. */
export function serviceAccountFrom(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null;
  try {
    const json = JSON.parse(raw) as Record<string, unknown>;
    const { project_id: projectId, client_email: clientEmail, private_key: privateKey } = json;
    if (typeof projectId !== 'string' || typeof clientEmail !== 'string' || typeof privateKey !== 'string') return null;
    if (!privateKey.includes('BEGIN PRIVATE KEY')) return null;
    return { projectId, clientEmail, privateKey };
  } catch {
    return null;
  }
}

const b64url = (bytes: Uint8Array | string) =>
  btoa(typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes))
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const binary = atob(body);
  const der = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) der[i] = binary.charCodeAt(i);
  return der;
}

/** Signed assertion for the OAuth2 JWT bearer grant (valid one hour). */
export async function signedAssertion(account: ServiceAccount, nowSeconds: number): Promise<string> {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: account.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600,
  }));
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToDer(account.privateKey), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  return `${header}.${claims}.${b64url(new Uint8Array(signature))}`;
}

export class FcmClient {
  private cached: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly account: ServiceAccount,
    private readonly fetchFn: FetchLike = (url, init) => fetch(url, init),
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** OAuth2 access token, reused until a minute before it expires. */
  async accessToken(): Promise<string> {
    if (this.cached && this.cached.expiresAt - 60_000 > this.now()) return this.cached.token;
    const assertion = await signedAssertion(this.account, Math.floor(this.now() / 1000));
    const res = await this.fetchFn(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    });
    const body = (await res.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown } | null;
    if (!res.ok || typeof body?.access_token !== 'string') throw new Error('fcm_auth_failed');
    const seconds = typeof body.expires_in === 'number' ? body.expires_in : 3600;
    this.cached = { token: body.access_token, expiresAt: this.now() + seconds * 1000 };
    return body.access_token;
  }

  async send(token: string, title: string, body: string, data: Record<string, string>): Promise<SendResult> {
    const res = await this.fetchFn(`https://fcm.googleapis.com/v1/projects/${this.account.projectId}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await this.accessToken()}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: { token, notification: { title, body }, data, android: { priority: 'high' } },
      }),
    });
    if (res.ok) {
      await res.body?.cancel();
      return 'sent';
    }
    const error = (await res.json().catch(() => null)) as { error?: { status?: string } } | null;
    // UNREGISTERED (404) or a malformed token (400 INVALID_ARGUMENT): drop it.
    const status = error?.error?.status;
    return res.status === 404 || status === 'UNREGISTERED' || status === 'INVALID_ARGUMENT' ? 'invalid_token' : 'failed';
  }
}
