import { type ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('shows one friendly notice per burst of errors', () => {
    // Angular calls it through the ErrorHandler contract, with the error.
    const handler: ErrorHandler = TestBed.inject(AppErrorHandler);
    handler.handleError(new Error('boom'));
    handler.handleError(new Error('boom again'));
    expect(toast.show).toHaveBeenCalledTimes(1);
    expect(toast.show).toHaveBeenCalledWith({ messageKey: 'errors.unexpected', tone: 'error' });

    vi.advanceTimersByTime(6000);
    handler.handleError(new Error('later'));
    expect(toast.show).toHaveBeenCalledTimes(2);
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
