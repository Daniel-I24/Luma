import type { WompiEnvironment } from './merchant-credentials.ts';
import { SecureCompare, sha256Hex } from './secure-compare.ts';

/** The transaction fields Luma reads from an event (never the customer's email or name). */
export interface EventTransaction {
  readonly id: string;
  readonly reference: string;
  readonly status: string;
  readonly amountInCents: number;
  readonly currency: string;
  readonly paymentMethodType: string | null;
}

/** A Wompi event whose shape was checked (docs.wompi.co, "Eventos"). */
export interface WompiEvent {
  readonly event: string;
  readonly environment: WompiEnvironment;
  readonly timestamp: number;
  readonly properties: readonly string[];
  readonly checksum: string;
  /** The raw data object: the signed properties point into it. */
  readonly data: Readonly<Record<string, unknown>>;
  /** Present for transaction.updated. */
  readonly transaction: EventTransaction | null;
}

const PROPERTY = /^[a-z_]{1,40}(\.[a-z_]{1,40}){1,3}$/;
const HEX_64 = /^[0-9a-fA-F]{64}$/;
const TRANSACTION_ID = /^[0-9A-Za-z_-]{1,64}$/;
const MAX_PROPERTIES = 10;

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;

/**
 * WompiEventParser — schema step of the verifier chain. Strict: anything
 * unexpected gives null, and only fields Luma needs are kept.
 */
export class WompiEventParser {
  public static parse(body: unknown): WompiEvent | null {
    const root = record(body);
    const signature = record(root?.['signature']);
    const data = record(root?.['data']);
    if (!root || !signature || !data) return null;
    const { event, environment, timestamp } = root;
    const { properties, checksum } = signature;
    if (typeof event !== 'string' || event.length > 60) return null;
    if (environment !== 'test' && environment !== 'prod') return null;
    if (typeof timestamp !== 'number' || !Number.isSafeInteger(timestamp) || timestamp <= 0) return null;
    if (typeof checksum !== 'string' || !HEX_64.test(checksum)) return null;
    if (!Array.isArray(properties) || properties.length < 1 || properties.length > MAX_PROPERTIES) return null;
    if (!properties.every((p) => typeof p === 'string' && PROPERTY.test(p))) return null;
    const transaction = WompiEventParser.parseTransaction(data['transaction']);
    if (event === 'transaction.updated' && !transaction) return null;
    return { event, environment, timestamp, properties: properties as string[], checksum, data, transaction };
  }

  /** The transaction object of an event or of GET /v1/transactions/{id}. */
  public static parseTransaction(value: unknown): EventTransaction | null {
    const tx = record(value);
    if (!tx) return null;
    const { id, reference, status, amount_in_cents: amount, currency, payment_method_type: method } = tx;
    if (typeof id !== 'string' || !TRANSACTION_ID.test(id)) return null;
    if (typeof reference !== 'string' || reference.length > 255) return null;
    if (typeof status !== 'string' || typeof currency !== 'string') return null;
    if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0) return null;
    const paymentMethodType = typeof method === 'string' && /^[A-Z_]{1,30}$/.test(method) ? method : null;
    return { id, reference, status, amountInCents: amount, currency, paymentMethodType };
  }
}

/**
 * EventChecksum — SHA-256 of the values of signature.properties (looked up
 * in data, in their order), then the timestamp, then the events secret,
 * concatenated without separators; compared in constant time.
 */
export class EventChecksum {
  /** Null when a property is missing or is not a string or number. */
  public static async compute(event: WompiEvent, eventsSecret: string): Promise<string | null> {
    let text = '';
    for (const property of event.properties) {
      const value = EventChecksum.lookup(event.data, property);
      if (value === null) return null;
      text += value;
    }
    return await sha256Hex(`${text}${event.timestamp}${eventsSecret}`);
  }

  public static async verify(event: WompiEvent, eventsSecret: string): Promise<boolean> {
    const expected = await EventChecksum.compute(event, eventsSecret);
    return expected !== null && SecureCompare.equalHex(event.checksum, expected);
  }

  private static lookup(data: Readonly<Record<string, unknown>>, path: string): string | null {
    let node: unknown = data;
    for (const key of path.split('.')) {
      const container = record(node);
      if (!container || !Object.hasOwn(container, key)) return null;
      node = container[key];
    }
    return typeof node === 'string' || (typeof node === 'number' && Number.isFinite(node)) ? String(node) : null;
  }
}
