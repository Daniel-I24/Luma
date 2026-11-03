import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { UserDataRegistry } from '@core/auth/user-data-registry';
import { PanelQueryLog } from '@shared/business/diagnostics/panel-query-log';
import { OwnerContextStore } from '../../state/owner-context.store';
import { TechnicalInfo } from './technical-info';

const USER = { id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', email: 'ana.perez@correo.com' };

describe('TechnicalInfo', () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    TestBed.configureTestingModule({
      imports: [
        TechnicalInfo,
        TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } }),
      ],
      providers: [
        { provide: AuthService, useValue: { user: signal(USER) } },
        { provide: OwnerContextStore, useValue: { count: signal(2) } },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(TechnicalInfo);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the masked account and every panel read with table, filter and rows, never personal data', async () => {
    const log = TestBed.inject(PanelQueryLog);
    log.record('businesses', PanelQueryLog.filter('owner_id', USER.id), 5);
    log.record('menu_items', PanelQueryLog.filter('business_id', 'b9c8d7e6-0000-4000-8000-000000000000'), null);
    const { el } = await render();

    expect(el.textContent).toContain('a********@c*****.com');
    expect(el.textContent).toContain('1a2b3c4d…');
    expect(el.textContent).not.toContain(USER.email);
    expect(el.textContent).not.toContain(USER.id);
    const rows = Array.from(el.querySelectorAll('tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td'), (td) => td.textContent?.trim()).join(' '));
    expect(rows).toEqual(['menu_items business_id = b9c8d7e6… owner.technical.failed', 'businesses owner_id = 1a2b3c4d… 5']);
  });

  it('"Copiar" puts the same report on the clipboard', async () => {
    TestBed.inject(PanelQueryLog).record('promotions', PanelQueryLog.filter('business_id', 'abcdefgh-1'), 3);
    const { fixture, el } = await render();
    const copy = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('owner.technical.copy'))!;
    copy.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    const report = writeText.mock.calls[0][0] as string;
    expect(report).toContain('businesses in panel: 2');
    expect(report).toContain('promotions [business_id = abcdefgh…] -> 3');
    expect(report).not.toContain(USER.email);
    fixture.detectChanges();
    expect(el.textContent).toContain('owner.technical.copied.ok');
  });

  it('the log is wiped at sign-out and keeps the latest 30 reads', () => {
    const log = TestBed.inject(PanelQueryLog);
    for (let i = 0; i < 40; i++) log.record('businesses', 'x', i);
    expect(log.entries()).toHaveLength(30);
    expect(log.entries()[0].rows).toBe(39);
    TestBed.inject(UserDataRegistry).clearAll();
    expect(log.entries()).toEqual([]);
  });

  it('masks any e-mail', () => {
    expect(TechnicalInfo.maskEmail('x@y.co')).toBe('x*@y*.co');
    expect(TechnicalInfo.maskEmail('bad')).toBe('');
  });
});
