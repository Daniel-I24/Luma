import { InjectionToken } from '@angular/core';
import type { ErrorLogEntry } from './error-log';

/**
 * ErrorReporter — where recorded errors may go beyond the device (Sentry,
 * Crashlytics…). It only ever receives ErrorLog's masked entries. The
 * default sends nothing: provide another implementation to report.
 */
export interface ErrorReporter {
  report(entry: ErrorLogEntry): void;
}

export const ERROR_REPORTER = new InjectionToken<ErrorReporter>('ERROR_REPORTER', {
  providedIn: 'root',
  factory: () => ({ report: () => undefined }),
});
