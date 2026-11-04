import { ErrorHandler, Injectable, inject, isDevMode } from '@angular/core';
import { ErrorLog } from '@core/errors/error-log';
import { UserFacingError } from '@core/errors/user-facing-error';
import { ToastService } from '@design-system/toast/toast.service';

/** At most one notice in this window, so an error loop never floods the screen. */
const QUIET_MS = 5000;
/** A lazy screen that could not be downloaded (old version or no network). */
const CHUNK_FAILED = /dynamically imported module|Loading chunk|Importing a module script failed/i;

/**
 * AppErrorHandler — the last line of defence for errors nothing else
 * handled (Angular and, through provideBrowserGlobalErrorListeners, window
 * errors). Every error goes to ErrorLog ("Información técnica"); the global
 * notice appears only for errors the user can act on: a UserFacingError
 * shows its own message and a screen that failed to download asks to check
 * the connection. Technical failures (a realtime channel, push, a plugin)
 * stay quiet: the screens degrade on their own. In development (ng serve)
 * the real error is also written to the console.
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly toast = inject(ToastService);
  private readonly log = inject(ErrorLog);
  private lastShown = Number.NEGATIVE_INFINITY;

  /** Records the error and shows a notice only when the user can act on it. */
  public handleError(error?: unknown): void {
    // Development only: production builds never print error details.
    if (this.devMode()) console.error('[Luma] unhandled error', error);
    const cause = AppErrorHandler.unwrap(error);
    this.log.record(cause);
    const messageKey = AppErrorHandler.messageKeyOf(cause);
    const now = Date.now();
    if (!messageKey || now - this.lastShown < QUIET_MS) return;
    this.lastShown = now;
    this.toast.show({ messageKey, tone: 'error' });
  }

  /** The translation key to show, or null for a technical error. */
  public static messageKeyOf(error: unknown): string | null {
    if (error instanceof UserFacingError) return error.messageKey;
    if (error instanceof Error && CHUNK_FAILED.test(error.message)) return 'errors.screenDownload';
    return null;
  }

  /** Promise rejections arrive wrapped ({ rejection } or { reason }). */
  private static unwrap(error: unknown): unknown {
    if (error && typeof error === 'object' && !(error instanceof Error)) {
      const wrapped = error as { rejection?: unknown; reason?: unknown };
      return wrapped.rejection ?? wrapped.reason ?? error;
    }
    return error;
  }

  /** Separate so tests can check both builds. */
  protected devMode(): boolean {
    return isDevMode();
  }
}
