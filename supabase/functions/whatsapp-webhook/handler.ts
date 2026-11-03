import { constantTimeEqual, senderHash, validSignature } from './signature.ts';
import { textMessages } from './payload.ts';

/** verify_contact_from_whatsapp as service_role; resolves to its outcome. */
type VerifyFromWhatsApp = (input: {
  messageId: string;
  senderHash: string;
  sender: string;
  code: string;
}) => Promise<string>;

export interface WhatsAppWebhookDeps {
  /** WHATSAPP_VERIFY_TOKEN and WHATSAPP_APP_SECRET; without them nothing is processed. */
  readonly verifyToken: string | null;
  readonly appSecret: string | null;
  readonly verify: VerifyFromWhatsApp;
  /** Lets processing finish after the 200 (EdgeRuntime.waitUntil); tests await it. */
  readonly background?: (work: Promise<unknown>) => void;
}

/** Meta's payloads are at most 3 MB; verification messages are tiny. */
const MAX_BODY_BYTES = 256 * 1024;

const ok = (): Response => new Response(null, { status: 200 });

async function readRaw(req: Request): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return null;
  const bytes = new Uint8Array(await req.arrayBuffer());
  return bytes.byteLength > MAX_BODY_BYTES ? null : bytes;
}

/**
 * whatsapp-webhook (verify_jwt = false) — Meta calls it, never the app.
 * GET: subscription check (hub.mode = subscribe and hub.verify_token equal to
 * WHATSAPP_VERIFY_TOKEN) answers hub.challenge. POST: the X-Hub-Signature-256
 * HMAC of the raw body is checked BEFORE reading it; then 200 at once and,
 * in the background, each text message with a LUMA code goes to
 * verify_contact_from_whatsapp (idempotent by message id). It never replies
 * to anyone and logs no number nor text.
 */
export function createHandler(deps: WhatsAppWebhookDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'GET') return subscribe(req, deps.verifyToken);
    if (req.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } });
    // Without secrets the function stays inert (the flag in the database is off as well).
    if (!deps.appSecret) return ok();
    const raw = await readRaw(req);
    if (!raw || !(await validSignature(deps.appSecret, raw, req.headers.get('x-hub-signature-256')))) {
      return new Response(null, { status: 401 });
    }
    let body: unknown = null;
    try {
      body = JSON.parse(new TextDecoder().decode(raw));
    } catch {
      return ok();
    }
    const work = process(deps, body);
    if (deps.background) deps.background(work);
    else await work;
    return ok();
  };
}

function subscribe(req: Request, verifyToken: string | null): Response {
  const params = new URL(req.url).searchParams;
  const token = params.get('hub.verify_token') ?? '';
  const challenge = params.get('hub.challenge') ?? '';
  if (!verifyToken || params.get('hub.mode') !== 'subscribe' || !constantTimeEqual(token, verifyToken)) {
    return new Response(null, { status: 403 });
  }
  return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

async function process(deps: WhatsAppWebhookDeps, body: unknown): Promise<void> {
  for (const message of textMessages(body)) {
    if (!message.code) continue;
    try {
      await deps.verify({
        messageId: message.id,
        senderHash: await senderHash(deps.appSecret!, message.from),
        sender: message.from,
        code: message.code,
      });
    } catch {
      // One failing message never stops the others; Meta does not retry a 200.
      console.error('whatsapp-webhook: verification call failed');
    }
  }
}
