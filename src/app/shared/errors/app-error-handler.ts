import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ToastService } from '@design-system/toast/toast.service';

/** At most one notice in this window, so an error loop never floods the screen. */
const QUIET_MS = 5000;

/**
 * AppErrorHandler — the last line of defence for errors nothing else
 * handled (Angular and, through provideBrowserGlobalErrorListeners, window
 * errors): a friendly notice instead of a blank or frozen screen. The app
 * keeps running; expected failures are handled where they happen.
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly toast = inject(ToastService);
  private lastShown = Number.NEGATIVE_INFINITY;

  handleError(): void {
    const now = Date.now();
    if (now - this.lastShown < QUIET_MS) return;
    this.lastShown = now;
    this.toast.show({ messageKey: 'errors.unexpected', tone: 'error' });
  }
}
