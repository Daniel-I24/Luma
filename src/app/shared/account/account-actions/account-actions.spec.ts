import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { ToastService } from '@design-system';
import { DataExport } from '../data-export.service';
import { AccountActions } from './account-actions';

describe('AccountActions: "Descargar mis datos"', () => {
  const dataExport = { download: vi.fn() };
  const toast = { show: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [AccountActions, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { loading: signal(false), user: signal({ id: 'u1', email: 'ana@example.test' }), signOut: vi.fn() } },
        { provide: DataExport, useValue: dataExport },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  async function press() {
    const fixture = TestBed.createComponent(AccountActions);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('account.export.action'))!.click();
    await vi.waitFor(() => expect(dataExport.download).toHaveBeenCalled());
    await fixture.whenStable();
    fixture.detectChanges();
    return el;
  }

  it('delivers the copy and says how it arrived', async () => {
    dataExport.download.mockResolvedValue({ errorKey: null, delivered: 'download' });
    await press();
    expect(toast.show).toHaveBeenCalledWith({ messageKey: 'account.export.done.download', tone: 'success' });
  });

  it('a refusal is shown as a translated message', async () => {
    dataExport.download.mockResolvedValue({ errorKey: 'account.export.errors.limit', delivered: null });
    const el = await press();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('account.export.errors.limit');
    expect(toast.show).not.toHaveBeenCalled();
  });
});
