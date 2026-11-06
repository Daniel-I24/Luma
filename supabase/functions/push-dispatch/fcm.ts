/** Firebase Cloud Messaging HTTP v1 with a service account (RS256 JWT, OAuth2). */

import { FCM_SCOPE, FCM_SEND_URL, GOOGLE_OAUTH_TOKEN_URL } from '../_shared/config/provider-urls.ts';

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface ServiceAccount {
  readonly projectId: string;
  readonly clientEmail: string;
  readonly privateKey: string;
}

/** A failure carries FCM's code when there is one: `failed:SENDER_ID_MISMATCH`. */
export type SendResult = 'sent' | 'invalid_token' | 'failed' | `failed:${string}`;

/** Monochrome mark in the APK (res/drawable/ic_stat_luma.xml) and the brand blue. */
const NOTIFICATION_ICON = 'ic_stat_luma';
const NOTIFICATION_COLOR = '#0D4A6B';

/** What one device receives: visible text, ids for the app, and the Android channel. */
export interface PushMessage {
  readonly title: string;
  readonly body: string;
  readonly data: Record<string, string>;
  readonly channelId: string;
}


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
    iss: account.clientEmail, scope: FCM_SCOPE, aud: GOOGLE_OAUTH_TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600,
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
    const res = await this.fetchFn(GOOGLE_OAUTH_TOKEN_URL, {
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

  async send(token: string, message: PushMessage): Promise<SendResult> {
    const res = await this.fetchFn(FCM_SEND_URL(this.account.projectId), {
      method: 'POST',
      headers: { authorization: `Bearer ${await this.accessToken()}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: message.title, body: message.body },
          data: message.data,
          android: {
            priority: 'high',
            notification: {
              channel_id: message.channelId, icon: NOTIFICATION_ICON, color: NOTIFICATION_COLOR,
              // Android 7 reads these from the message; from 8 on the channel decides.
              sound: 'default', default_vibrate_timings: true, notification_priority: 'PRIORITY_HIGH',
            },
          },
        },
      }),
    });
    if (res.ok) {
      await res.body?.cancel();
      return 'sent';
    }
    const error = (await res.json().catch(() => null)) as FcmErrorBody | null;
    return isDeadToken(res.status, error) ? 'invalid_token' : `failed:${failureCode(res.status, error)}`;
  }
}

/** The parts of an FCM v1 error body used to classify a failed send. */
export interface FcmErrorBody {
  readonly error?: {
    readonly status?: string;
    readonly message?: string;
    readonly details?: readonly { readonly errorCode?: string; readonly fieldViolations?: readonly { readonly field?: string }[] }[];
  };
}

/** The most specific code of a failed send; only codes, never free text. */
function failureCode(httpStatus: number, body: FcmErrorBody | null): string {
  const detail = (body?.error?.details ?? []).find((d) => d.errorCode)?.errorCode;
  return detail ?? body?.error?.status ?? String(httpStatus);
}

/**
 * True only when FCM says the token itself is gone or malformed: 404, or
 * UNREGISTERED, or INVALID_ARGUMENT that points at message.token. Any other
 * INVALID_ARGUMENT (a bad payload on our side) must not delete the device.
 */
export function isDeadToken(httpStatus: number, body: FcmErrorBody | null): boolean {
  if (httpStatus === 404) return true;
  const error = body?.error;
  const codes = new Set([error?.status, ...(error?.details ?? []).map((d) => d.errorCode)]);
  if (codes.has('UNREGISTERED')) return true;
  if (!codes.has('INVALID_ARGUMENT')) return false;
  const tokenField = (error?.details ?? []).some((d) => (d.fieldViolations ?? []).some((v) => v.field === 'message.token'));
  return tokenField || /registration token/i.test(error?.message ?? '');
}
