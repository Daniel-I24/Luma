import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { PushDiagnostics } from '@core/push/push-diagnostics';
import { AdminRepository } from '@shared/business/verification/admin.repository';
import { DeviceStatus } from './device-status';

describe('DeviceStatus', () => {
  function render() {
    const lastAccess = signal({ access: 'error', code: 'PGRST202', at: '2026-11-05T10:00:00.000Z' });
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [{ provide: AdminRepository, useValue: { lastAccess } }],
    });
    const diagnostics = TestBed.inject(PushDiagnostics);
    const fixture = TestBed.createComponent(DeviceStatus);
    return { fixture, diagnostics, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the admin answer and each push step, in order', () => {
    const { fixture, diagnostics, el } = render();
    diagnostics.record('permission', true, 'granted');
    diagnostics.record('rpc', false, 'email_not_confirmed');
    fixture.detectChanges();

    const rows = Array.from(el.querySelectorAll('dd')).map((dd) => dd.textContent ?? '');
    expect(rows[0]).toContain('error · PGRST202');
    expect(rows[1]).toContain('ok · granted');
    expect(rows[6]).toContain('failed · email_not_confirmed');
    expect(el.querySelectorAll('dt')).toHaveLength(7);
  });

  it('never shows a whole token', () => {
    const { fixture, diagnostics, el } = render();
    const token = 'abcdefghijklmnopqrstuvwxyz0123456789';
    diagnostics.record('event', true, PushDiagnostics.mask(token));
    fixture.detectChanges();

    expect(el.textContent).not.toContain(token);
    expect(el.textContent).toContain(`…${token.slice(-6)} (${token.length})`);
  });
});
