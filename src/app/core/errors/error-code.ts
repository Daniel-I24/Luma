/** A code a database function raises, or one of the app's own: lower_snake_case. */
const RAISED = /^[a-z][a-z0-9_]{2,47}$/;
/** A Postgres or PostgREST code (42883, PGRST202). */
const SERVER_CODE = /^[A-Z0-9]{5,8}$/;
/** A native code inside a longer message (SERVICE_NOT_AVAILABLE, FIS_AUTH_ERROR). */
const NATIVE_CODE = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/;
const NETWORK = /fetch|network|load failed|timed? ?out/i;
/** Postgres' code for `raise exception`: the message holds the real reason. */
const GENERIC_RAISE = 'P0001';

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * ErrorCode — the reason of a failure as a short code that is safe to keep and
 * show in "Información técnica". Only codes pass: free text (which could hold
 * personal data) becomes 'network' or 'unknown', never a quote of the message.
 */
export class ErrorCode {
  /** The code of a Supabase error, a thrown error or a plugin's rejection. */
  public static of(error: unknown): string {
    if (!error || typeof error !== 'object') return 'unknown';
    const { code: rawCode, message: rawMessage } = error as { code?: unknown; message?: unknown };
    const code = text(rawCode);
    const message = text(rawMessage);
    if (SERVER_CODE.test(code) && code !== GENERIC_RAISE) return code;
    if (RAISED.test(message)) return message;
    const native = NATIVE_CODE.exec(message)?.[0];
    if (native) return native;
    return NETWORK.test(message) ? 'network' : 'unknown';
  }
}
