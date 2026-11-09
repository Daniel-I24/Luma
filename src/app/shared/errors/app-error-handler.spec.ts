import { type ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorLog } from '@core/errors/error-log';
import { UserFacingError } from '@core/errors/user-facing-error';
import { ConnectivityService } from '@core/network/connectivity.service';
import { ToastService } from '@design-system/toast/toast.service';
import { ConnectionNotice } from '../layout/connection-notice/connection-notice';
import { AppErrorHandler } from './app-error-handler';

describe('AppErrorHandler', () => {
  const toast = { show: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    TestBed.configureTestingModule({
      providers: [AppErrorHandler, { provide: ToastService, useValue: toast }],
    });
  });
  afterEach(() => vi.useRealTimers());

  it('ignores the ResizeObserver notice of the browser: nothing is logged or shown', () => {
    const log = TestBed.inject(ErrorLog);
    const record = vi.spyOn(log, 'record');
    TestBed.inject(AppErrorHandler).handleError(new Error('An ErrorEvent with no error occurred: ResizeObserver loop completed with undelivered notifications.'));
    expect(record).not.toHaveBeenCalled();
    expect(toast.show).not.toHaveBeenCalled();
  });

  it('shows one notice per burst of errors the user can act on', () => {
    // Angular calls it through the ErrorHandler contract, with the error.
    const handler: ErrorHandler = TestBed.inject(AppErrorHandler);
    handler.handleError(new UserFacingError('errors.offline'));
    handler.handleError(new UserFacingError('errors.offline'));
    expect(toast.show).toHaveBeenCalledTimes(1);
    expect(toast.show).toHaveBeenCalledWith({ messageKey: 'errors.offline', tone: 'error' });

    vi.advanceTimersByTime(6000);
    handler.handleError(new TypeError('Failed to fetch dynamically imported module: /chunk-1.js'));
    expect(toast.show).toHaveBeenLastCalledWith({ messageKey: 'errors.screenDownload', tone: 'error' });
  });

  it('keeps technical errors quiet but records them (a failed realtime channel at sign-in)', () => {
    const handler = TestBed.inject(AppErrorHandler);
    handler.handleError({ rejection: new Error('channel error for ana@mail.com') });
    expect(toast.show).not.toHaveBeenCalled();
    expect(TestBed.inject(ErrorLog).entries()[0]).toMatchObject({ name: 'Error', message: 'channel error for <email>' });
  });

  it('writes the real error to the console in development only', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = TestBed.inject(AppErrorHandler);
    const dev = vi.spyOn(handler as unknown as { devMode(): boolean }, 'devMode');
    const error = new Error('Capacitor plugin not implemented on web');

    dev.mockReturnValue(true);
    handler.handleError(error);
    expect(log).toHaveBeenCalledWith('[Luma] unhandled error', error);

    log.mockClear();
    dev.mockReturnValue(false);
    handler.handleError(error);
    expect(log).not.toHaveBeenCalled();
  });
});

describe('ConnectionNotice', () => {
  it('appears only while offline', () => {
    const online = signal(true);
    TestBed.configureTestingModule({
      imports: [
        ConnectionNotice,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [{ provide: ConnectivityService, useValue: { online } }],
    });
    const fixture = TestBed.createComponent(ConnectionNotice);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="status"]')).toBeNull();

    online.set(false);
    fixture.detectChanges();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('errors.offlineBanner');
  });
});
