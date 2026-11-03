import { json } from '../_shared/edge.ts';
import type { SendResult } from './fcm.ts';
import { pushData, type PushRow, pushText } from './messages.ts';

/** Server-only access (service role): claim_push_batch and remove_device_tokens. */
export interface PushStore {
  claim(limit: number): Promise<PushRow[]>;
  removeTokens(tokens: string[]): Promise<void>;
}

export interface Sender {
  send(token: string, title: string, body: string, data: Record<string, string>): Promise<SendResult>;
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
  const a = new TextEncoder().encode(given ?? '');
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
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
    const invalid: string[] = [];
    try {
      for (let batch = 0; batch < MAX_BATCHES; batch++) {
        const rows = await deps.store.claim(BATCH);
        for (const row of rows) {
          const text = pushText(row);
          if (!text) continue;
          for (const token of row.tokens) {
            const result = await deps.sender.send(token, text.title, text.body, pushData(row));
            if (result === 'sent') sent++;
            if (result === 'invalid_token') invalid.push(token);
          }
        }
        if (rows.length < BATCH) break;
      }
      if (invalid.length) await deps.store.removeTokens(invalid);
      return json(200, { sent, removed: invalid.length });
    } catch {
      return json(503, { error: 'push_unavailable', sent });
    }
  };
}
