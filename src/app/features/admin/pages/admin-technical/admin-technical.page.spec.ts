import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { UserDataRegistry } from '@core/auth/session-end';
import { PanelQueryLog } from '@shared/business/diagnostics/panel-query-log';
import { AdminRepository } from '@shared/business/verification/admin.repository';
import { adminRoutes } from '../../admin.routes';
import { AdminTechnicalPage } from './admin-technical.page';

const USER = { id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', email: 'ana.perez@correo.com' };

describe('AdminTechnicalPage', () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const access = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    TestBed.configureTestingModule({
      imports: [
        AdminTechnicalPage,
        TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } }),
      ],
      providers: [
        provideRouter([{ path: 'admin', children: adminRoutes }, { path: 'profile', children: [] }]),
        { provide: AuthService, useValue: { user: signal(USER) } },
        { provide: AdminRepository, useValue: { access, lastAccess: signal(null) } },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(AdminTechnicalPage);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it.each([
    ['none', '/profile'],
    ['needs_mfa', '/admin/mfa'],
    ['error', '/admin/access-error'],
  ])('the route refuses anyone without access: %s goes to %s', async (answer, target) => {
    access.mockResolvedValue(answer);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin/technical');
    expect(router.url).toBe(target);
  });

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
    expect(rows).toEqual(['menu_items business_id = b9c8d7e6… admin.technical.failed', 'businesses owner_id = 1a2b3c4d… 5']);
  });

  it('"Copiar" puts the same report on the clipboard', async () => {
    TestBed.inject(PanelQueryLog).record('promotions', PanelQueryLog.filter('business_id', 'abcdefgh-1'), 3);
    const { fixture, el } = await render();
    const copy = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('admin.technical.copy'))!;
    copy.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    const report = writeText.mock.calls[0]?.[0] as string;
    expect(report).toContain('promotions [business_id = abcdefgh…] -> 3');
    expect(report).not.toContain(USER.email);
    fixture.detectChanges();
    expect(el.textContent).toContain('admin.technical.copied.ok');
  });

  it('the log is wiped at sign-out and keeps the latest 30 reads', () => {
    const log = TestBed.inject(PanelQueryLog);
    for (let i = 0; i < 40; i++) log.record('businesses', 'x', i);
    expect(log.entries()).toHaveLength(30);
    expect(log.entries()[0]?.rows).toBe(39);
    TestBed.inject(UserDataRegistry).clearAll();
    expect(log.entries()).toEqual([]);
  });

  it('masks any e-mail', () => {
    expect(AdminTechnicalPage.maskEmail('x@y.co')).toBe('x*@y*.co');
    expect(AdminTechnicalPage.maskEmail('bad')).toBe('');
  });
});
