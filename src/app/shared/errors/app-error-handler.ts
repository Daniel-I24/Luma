import { ErrorHandler, Injectable, inject, isDevMode } from '@angular/core';
import { ToastService } from '@design-system/toast/toast.service';

/** At most one notice in this window, so an error loop never floods the screen. */
const QUIET_MS = 5000;

/**
 * AppErrorHandler — the last line of defence for errors nothing else
 * handled (Angular and, through provideBrowserGlobalErrorListeners, window
 * errors): a friendly notice instead of a blank or frozen screen. The app
 * keeps running; expected failures are handled where they happen. In
 * development (ng serve) the real error is also written to the console, so
 * "Algo salió mal" on localhost always has a cause to read.
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly toast = inject(ToastService);
  private lastShown = Number.NEGATIVE_INFINITY;

  /** Shows a generic error toast (at most once per quiet period); details never reach the UI. */
  public handleError(error?: unknown): void {
    // Development only: production builds never print error details.
    if (this.devMode()) console.error('[Luma] unhandled error', error);
    const now = Date.now();
    if (now - this.lastShown < QUIET_MS) return;
    this.lastShown = now;
    this.toast.show({ messageKey: 'errors.unexpected', tone: 'error' });
  }

  /** Separate so tests can check both builds. */
  protected devMode(): boolean {
    return isDevMode();
  }
}
