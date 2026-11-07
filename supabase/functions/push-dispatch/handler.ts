import { json } from '../_shared/edge.ts';
import { SecureCompare } from '../_shared/secure-compare.ts';
import type { PushMessage, SendResult } from './fcm.ts';
import { channelFor, pushData, type PushRow, pushText } from './messages.ts';

/** Server-only access (service role): claim_push_batch and remove_device_tokens. */
interface PushStore {
  claim(limit: number): Promise<PushRow[]>;
  /** The retries that are due: only the phones that failed, once. */
  claimRetries(limit: number): Promise<PushRow[]>;
  /** Tries again later; answers how many were scheduled (0 once the attempts end). */
  scheduleRetry(notificationId: string, tokens: string[], attempt: number): Promise<number>;
  removeTokens(tokens: string[]): Promise<void>;
}

interface Sender {
  send(token: string, message: PushMessage): Promise<SendResult>;
}

export interface DispatchDeps {
  /** PUSH_DISPATCH_SECRET; the same value as private.push_settings.secret. */
  readonly secret: string | null;
  readonly store: PushStore;
  /** Null when FCM_SERVICE_ACCOUNT is missing: nothing is claimed. */
  readonly sender: Sender | null;
}

export const BATCH = 100;
const MAX_BATCHES = 5;
/** PUSH_DISPATCH_SECRET is 32 random bytes in hex (luma.ps1); anything shorter is refused. */
const MIN_SECRET_LENGTH = 32;

/** FCM will answer the same again: a bad message or a wrong project, not a passing fault. */
const PERMANENT = new Set(['INVALID_ARGUMENT', 'SENDER_ID_MISMATCH', 'THIRD_PARTY_AUTH_ERROR', 'PERMISSION_DENIED', 'NOT_FOUND']);

export function shouldRetry(reason: string): boolean {
  return !PERMANENT.has(reason);
}

/** Constant-time comparison of the shared secret. */
export function sameSecret(given: string | null, expected: string): boolean {
  return SecureCompare.equal(given ?? '', expected);
}

/** One send: a thrown error (network, OAuth) counts as failed and never stops the batch. */
async function sendOne(sender: Sender, token: string, message: PushMessage): Promise<SendResult> {
  try {
    return await sender.send(token, message);
  } catch (error) {
    // Our own codes (fcm_auth_failed); anything else stays generic.
    const message = error instanceof Error ? error.message : '';
    return /^[a-z_]{3,40}$/.test(message) ? `failed:${message}` : 'failed';
  }
}

/**
 * Called by the database (pg_net poke, pg_cron fallback), never by the app:
 * claims unsent notifications and sends them. Each one is claimed once; a phone
 * that failed for a passing reason is tried again (migration 62), and a phone that
 * got it never gets it twice. The in-app list always has it.
 */
export function createHandler(deps: DispatchDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, { Allow: 'POST' });
    if (!deps.secret || deps.secret.length < MIN_SECRET_LENGTH || !sameSecret(req.headers.get('x-push-secret'), deps.secret)) {
      return json(401, { error: 'unauthorized' });
    }
    await req.body?.cancel();
    if (!deps.sender) return json(503, { error: 'push_unavailable' });

    const sender = deps.sender;
    let sent = 0;
    let failed = 0;
    let retrying = 0;
    const reasons: Record<string, number> = {};
    const invalid: string[] = [];
    const deliver = async (rows: PushRow[]): Promise<void> => {
      for (const row of rows) {
        const text = pushText(row);
        if (!text) continue;
        const message: PushMessage = { ...text, data: pushData(row), channelId: channelFor(row.type) };
        const again: string[] = [];
        for (const token of row.tokens) {
          const result = await sendOne(sender, token, message);
          if (result === 'sent') sent++;
          if (result === 'invalid_token') invalid.push(token);
          if (result.startsWith('failed')) {
            failed++;
            const reason = result.split(':')[1] ?? 'unknown';
            reasons[reason] = (reasons[reason] ?? 0) + 1;
            if (shouldRetry(reason)) again.push(token);
          }
        }
        if (again.length) retrying += await deps.store.scheduleRetry(row.notification_id, again, row.attempt ?? 0);
      }
    };
    try {
      for (let batch = 0; batch < MAX_BATCHES; batch++) {
        const rows = await deps.store.claim(BATCH);
        await deliver(rows);
        if (rows.length < BATCH) break;
      }
      await deliver(await deps.store.claimRetries(BATCH));
      if (invalid.length) await deps.store.removeTokens(invalid);
      return json(200, { sent, failed, retrying, removed: invalid.length, reasons });
    } catch {
      return json(503, { error: 'push_unavailable', sent });
    }
  };
}
