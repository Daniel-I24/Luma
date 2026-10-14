import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LumaToastHost } from './luma-toast-host';
import { ToastService } from './toast.service';

describe('ToastService and LumaToastHost', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [
        LumaToastHost,
        TranslocoTestingModule.forRoot({
          langs: { es: { common: { close: 'Cerrar' }, demo: { saved: 'Guardado {{name}}' } } },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('queues toasts and dismisses them after their duration', () => {
    const service = TestBed.inject(ToastService);

    service.show({ messageKey: 'demo.saved', durationMs: 1000 });
    expect(service.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(service.toasts()).toHaveLength(0);
  });

  it('renders translated messages in a polite live region', () => {
    const service = TestBed.inject(ToastService);
    const fixture = TestBed.createComponent(LumaToastHost);

    service.show({ messageKey: 'demo.saved', params: { name: 'La Casona' }, tone: 'success' });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[aria-live="polite"]')?.textContent).toContain('Guardado La Casona');
  });

  it('dismisses a toast from its close button', () => {
    const service = TestBed.inject(ToastService);
    const fixture = TestBed.createComponent(LumaToastHost);
    service.show({ messageKey: 'demo.saved' });
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();

    expect(service.toasts()).toHaveLength(0);
  });
});
