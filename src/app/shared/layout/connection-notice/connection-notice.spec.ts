import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentCheck } from '@core/config/environment-check';
import { ConnectivityService } from '@core/network/connectivity.service';
import { ConnectionNotice } from './connection-notice';

describe('ConnectionNotice', () => {
  const online = signal(true);
  const root = document.documentElement;
  const disconnect = vi.fn();
  let measured: (() => void) | null;

  beforeEach(() => {
    online.set(true);
    measured = null;
    disconnect.mockClear();
    vi.spyOn(EnvironmentCheck, 'usesPlaceholderConfig').mockReturnValue(false);
    TestBed.configureTestingModule({
      imports: [ConnectionNotice, TranslocoTestingModule.forRoot({ langs: { es: {} } })],
      providers: [{ provide: ConnectivityService, useValue: { online } }],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    root.style.removeProperty('--notice-height');
  });

  const stubObserver = (): void => {
    vi.stubGlobal('ResizeObserver', class {
      public constructor(callback: () => void) { measured = callback; }
      public observe = vi.fn();
      public disconnect = disconnect;
    });
  };

  const render = () => {
    const fixture = TestBed.createComponent(ConnectionNotice);
    fixture.detectChanges();
    const strip = fixture.nativeElement.querySelector('[aria-live]') as HTMLElement;
    vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue({ height: 95 } as DOMRect);
    return fixture;
  };

  const space = (): string => root.style.getPropertyValue('--notice-height');

  it('offline, the screens start below the strip', () => {
    stubObserver();
    const fixture = render();
    online.set(false);
    fixture.detectChanges();
    measured?.();
    TestBed.tick();
    expect(space()).toBe('95px');
  });

  it('online, it takes no space at all', () => {
    stubObserver();
    render();
    measured?.();
    TestBed.tick();
    expect(space()).toBe('0px');
  });

  it('back online frees the space while the strip is still leaving', () => {
    stubObserver();
    const fixture = render();
    online.set(false);
    fixture.detectChanges();
    measured?.();
    TestBed.tick();
    online.set(true);
    TestBed.tick();
    expect(space()).toBe('0px');
  });

  it('the development reminder takes its space too, online', () => {
    vi.mocked(EnvironmentCheck.usesPlaceholderConfig).mockReturnValue(true);
    stubObserver();
    render();
    measured?.();
    TestBed.tick();
    expect(space()).toBe('95px');
  });

  it('stops measuring when it goes away', () => {
    stubObserver();
    render().destroy();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('without ResizeObserver it still shows the notice', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    online.set(false);
    const fixture = render();
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain('errors.offlineBanner');
  });
});
