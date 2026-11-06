import { json } from '../_shared/edge.ts';
import { SecureCompare } from '../_shared/secure-compare.ts';
import type { PushMessage, SendResult } from './fcm.ts';
import { channelFor, pushData, type PushRow, pushText } from './messages.ts';

/** Server-only access (service role): claim_push_batch and remove_device_tokens. */
interface PushStore {
  claim(limit: number): Promise<PushRow[]>;
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
 * claims unsent notifications and sends them. Each notification is claimed
 * once (at most once delivery; the in-app list always has it).
 */
export function createHandler(deps: DispatchDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, { Allow: 'POST' });
    if (!deps.secret || deps.secret.length < 32 || !sameSecret(req.headers.get('x-push-secret'), deps.secret)) {
      return json(401, { error: 'unauthorized' });
    }
    await req.body?.cancel();
    if (!deps.sender) return json(503, { error: 'push_unavailable' });

    let sent = 0;
    let failed = 0;
    const reasons: Record<string, number> = {};
    const invalid: string[] = [];
    try {
      for (let batch = 0; batch < MAX_BATCHES; batch++) {
        const rows = await deps.store.claim(BATCH);
        for (const row of rows) {
          const text = pushText(row);
          if (!text) continue;
          const message: PushMessage = { ...text, data: pushData(row), channelId: channelFor(row.type) };
          for (const token of row.tokens) {
            const result = await sendOne(deps.sender, token, message);
            if (result === 'sent') sent++;
            if (result.startsWith('failed')) {
              failed++;
              const reason = result.split(':')[1] ?? 'unknown';
              reasons[reason] = (reasons[reason] ?? 0) + 1;
            }
            if (result === 'invalid_token') invalid.push(token);
          }
        }
        if (rows.length < BATCH) break;
      }
      if (invalid.length) await deps.store.removeTokens(invalid);
      return json(200, { sent, failed, removed: invalid.length, reasons });
    } catch {
      return json(503, { error: 'push_unavailable', sent });
    }
  };
}
