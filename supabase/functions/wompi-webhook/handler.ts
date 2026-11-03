import { readBody } from '../_shared/edge.ts';
import type { PaymentLog } from '../_shared/payments/payment-log.ts';
import type { VerifyResult } from '../_shared/payments/payment-event-verifier.ts';

/** Verifies and applies one event body (PaymentEventVerifier). */
export interface EventVerifier {
  verify(body: unknown): Promise<VerifyResult>;
}

export interface WebhookDeps {
  /** Null when a Wompi secret is missing or does not match WOMPI_ENV. */
  readonly verifier: EventVerifier | null;
  readonly log: PaymentLog;
}

/** Events are small JSON documents; anything bigger is refused unread. */
export const MAX_EVENT_BYTES = 64 * 1024;

const PROCESSED = (): Response => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
/** Every rejection looks the same: no hint of which check failed. Wompi retries non-200 answers. */
const REJECTED = (): Response => new Response('{}', { status: 400, headers: { 'Content-Type': 'application/json' } });

function parse(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}

/**
 * Called by Wompi without a user JWT (verify_jwt = false). Before touching
 * the database: POST, JSON content type, at most 64 KB, and the checksum
 * (inside the verifier, before idempotency). 200 only after the event was
 * processed; the redirect of the customer never approves anything.
 */
export function createHandler(deps: WebhookDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method !== 'POST' || !(req.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json')) {
      await req.body?.cancel();
      return REJECTED();
    }
    const bytes = await readBody(req, MAX_EVENT_BYTES);
    if (!bytes || !deps.verifier) {
      deps.log.info('event_rejected', { step: bytes ? 'unconfigured' : 'size', source: 'webhook' });
      return REJECTED();
    }
    try {
      const result = await deps.verifier.verify(parse(bytes));
      if (result.kind === 'reject') {
        deps.log.info('event_rejected', { step: result.step, source: 'webhook' });
        return REJECTED();
      }
      deps.log.info('event_processed', { outcome: result.outcome, source: 'webhook' });
      return PROCESSED();
    } catch {
      deps.log.info('event_rejected', { step: 'unavailable', source: 'webhook' });
      return REJECTED();
    }
  };
}
