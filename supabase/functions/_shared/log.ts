/** What a log line may carry besides its event: numbers only (counts, HTTP statuses). */
export interface LogFields {
  readonly status?: number;
  readonly count?: number;
}

export type LogSink = (line: string) => void;

const CODE = /^[a-z][a-z0-9_]{0,39}$/;
const code = (value: string): string => (CODE.test(value) ? value : 'redacted');

/**
 * EdgeLog — one JSON line per event for the Supabase logs: the function,
 * the level, an event code and numbers. No free text, ids, e-mails, phones
 * or secrets can get in: anything that is not a short code is "redacted".
 */
export class EdgeLog {
  private readonly fn: string;
  private readonly sink: LogSink;

  constructor(fn: string, sink: LogSink = (line) => console.error(line)) {
    this.fn = code(fn.replaceAll('-', '_'));
    this.sink = sink;
  }

  /** Something failed that the caller cannot fix (the answer stays generic). */
  public error(event: string, fields: LogFields = {}): void {
    this.write('error', event, fields);
  }

  private write(level: 'error', event: string, fields: LogFields): void {
    const numbers = Object.fromEntries(Object.entries(fields).filter(([, v]) => Number.isFinite(v)).map(([k, v]) => [k, Math.trunc(v)]));
    this.sink(JSON.stringify({ fn: this.fn, level, event: code(event), ...numbers }));
  }
}
