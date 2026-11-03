/** One inbound text message, as Meta sends it (entry[].changes[].value.messages[]). */
export interface InboundText {
  /** wamid of the message: the idempotency key. */
  readonly id: string;
  /** The sender in international format, digits only ("573001112233"). */
  readonly from: string;
  readonly code: string | null;
}

/** Exactly the code the app shows; nothing around it may change its letters. */
const CODE = /(?:^|[^A-Z0-9])(LUMA-[A-Z0-9]{6})(?![A-Z0-9])/;
const SENDER = /^[0-9]{8,15}$/;
const MAX_ID = 200;
/** A webhook carries a few messages; more is not a real delivery. */
const MAX_MESSAGES = 50;

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** The LUMA-XXXXXX code of a text, upper-cased first ("luma-ab12cd" counts), or null. */
export function extractCode(text: string): string | null {
  return text.toUpperCase().match(CODE)?.[1] ?? null;
}

/**
 * The text messages of a WhatsApp Business webhook (object
 * "whatsapp_business_account", changes[].field "messages"). Statuses, media
 * and anything malformed are ignored, never an error.
 */
export function textMessages(body: unknown): InboundText[] {
  const root = record(body);
  if (root?.object !== 'whatsapp_business_account') return [];
  const found: InboundText[] = [];
  for (const entry of list(root.entry)) {
    for (const change of list(record(entry)?.changes)) {
      const changeRecord = record(change);
      if (changeRecord?.field !== 'messages') continue;
      for (const message of list(record(changeRecord.value)?.messages)) {
        const m = record(message);
        const text = record(m?.text)?.body;
        if (m?.type !== 'text' || typeof m.id !== 'string' || typeof m.from !== 'string' || typeof text !== 'string') continue;
        if (!SENDER.test(m.from) || m.id.length > MAX_ID) continue;
        found.push({ id: m.id, from: m.from, code: extractCode(text) });
        if (found.length >= MAX_MESSAGES) return found;
      }
    }
  }
  return found;
}
