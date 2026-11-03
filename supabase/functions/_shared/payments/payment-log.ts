/** What a payment log line may say: codes and counts, never ids, emails, names or secrets. */
export interface PaymentLogFields {
  readonly outcome?: string;
  readonly step?: string;
  readonly source?: 'webhook' | 'reconcile' | 'void' | 'checkout';
  readonly count?: number;
}

export type LogSink = (line: string) => void;

/**
 * PaymentLog — structured, minimal logging for the payment functions. The
 * fields are typed so a caller cannot pass a reference, an email or a key;
 * values are also limited to short codes.
 */
export class PaymentLog {
  private static readonly CODE = /^[a-z_]{1,40}$/;

  // Edge Function logs go to the Supabase dashboard.
  public constructor(private readonly sink: LogSink = (line) => console.info(line)) {}

  public info(event: string, fields: PaymentLogFields = {}): void {
    const safe: Record<string, string | number> = { event: PaymentLog.code(event) };
    for (const [key, value] of Object.entries(fields)) {
      safe[key] = typeof value === 'number' ? Math.trunc(value) : PaymentLog.code(String(value));
    }
    this.sink(JSON.stringify(safe));
  }

  private static code(value: string): string {
    return PaymentLog.CODE.test(value) ? value : 'redacted';
  }
}
