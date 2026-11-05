import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { ERROR_REPORTER } from './error-reporter';

/** One recorded error: no personal data, only what support needs. */
export interface ErrorLogEntry {
  readonly name: string;
  /** Technical message with e-mails, numbers, ids and tokens masked. */
  readonly message: string;
  /** Path of the screen, ids replaced by ":id". */
  readonly route: string;
  readonly at: string;
  /** Who reported it: 'app' (unhandled), 'realtime', 'push'… */
  readonly source: string;
}

const MAX_ENTRIES = 20;
const MAX_MESSAGE = 200;
/** A path segment this long with a digit is an id, not a screen name. */
const ID_SEGMENT_MIN = 7;

/** Personal or secret-looking parts of a message, in the order they are masked. */
const MASKS: readonly (readonly [RegExp, string])[] = [
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>'],
  [/eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '<token>'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>'],
  [/\b[\w-]{32,}\b/g, '<token>'],
  [/\+?\d[\d\s-]{6,}\d/g, '<number>'],
];

/**
 * ErrorLog — the last 20 errors of this session, kept in memory only, for
 * "Información técnica". Every text is masked before it is stored, so the
 * list can be copied to support as it is; each entry also goes to the
 * ErrorReporter (none by default).
 */
@Injectable({ providedIn: 'root' })
export class ErrorLog {
  private readonly location = inject(DOCUMENT).defaultView?.location;
  private readonly reporter = inject(ERROR_REPORTER);
  private readonly _entries = signal<readonly ErrorLogEntry[]>([]);
  /** Most recent first. */
  public readonly entries = this._entries.asReadonly();

  /** Stores `error` (anything thrown) as a masked entry. */
  public record(error: unknown, source = 'app'): void {
    const entry: ErrorLogEntry = {
      name: ErrorLog.nameOf(error),
      message: ErrorLog.mask(ErrorLog.messageOf(error)).slice(0, MAX_MESSAGE),
      route: ErrorLog.maskRoute(this.location?.pathname ?? ''),
      at: new Date().toISOString(),
      source,
    };
    this._entries.update((list) => [entry, ...list].slice(0, MAX_ENTRIES));
    try {
      this.reporter.report(entry);
    } catch {
      // A broken reporter never breaks the app; the entry stays on the device.
    }
  }

  /** The text "Copiar" puts on the clipboard: one line per error. */
  public report(): string {
    return this._entries()
      .map((e) => `${e.at} [${e.source}] ${e.route} ${e.name}: ${e.message}`)
      .join('\n');
  }

  /** Masks e-mails, tokens, ids and long numbers. */
  public static mask(text: string): string {
    return MASKS.reduce((out, [pattern, label]) => out.replace(pattern, label), text);
  }

  private static maskRoute(path: string): string {
    return path
      .split('/')
      .map((part) => (/\d/.test(part) && part.length >= ID_SEGMENT_MIN ? ':id' : part))
      .join('/');
  }

  private static nameOf(error: unknown): string {
    if (error instanceof Error) return error.name;
    return typeof error === 'string' ? 'Message' : typeof error;
  }

  private static messageOf(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    try {
      return JSON.stringify(error) ?? '';
    } catch {
      return String(error);
    }
  }
}
