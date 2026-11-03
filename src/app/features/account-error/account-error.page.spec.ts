import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { AccountErrorPage } from './account-error.page';

describe('AccountErrorPage', () => {
  const failureKey = signal<string | null>(null);
  const store = { retry: vi.fn(), landingPath: vi.fn(), failureKey };
  const auth = { signOut: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    failureKey.set(null);
    TestBed.configureTestingModule({
      imports: [AccountErrorPage, TranslocoTestingModule.forRoot({ langs: { es: {} } })],
      providers: [
        provideRouter([]),
        { provide: SessionProfileStore, useValue: store },
        { provide: AuthService, useValue: auth },
        { provide: ConnectivityService, useValue: { online: signal(true) } },
      ],
    });
  });

  const buttons = () => {
    const fixture = TestBed.createComponent(AccountErrorPage);
    fixture.detectChanges();
    const all = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    return { fixture, retry: all[0], signOut: all[all.length - 1] };
  };

  it('Reintentar goes to the landing page once the profile loads', async () => {
    store.retry.mockResolvedValue(true);
    store.landingPath.mockResolvedValue('/owner');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const { retry, fixture } = buttons();
    retry.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/owner');
  });

  it('a second failure stays here and says so', async () => {
    store.retry.mockResolvedValue(false);
    const { retry, fixture } = buttons();
    retry.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('Cerrar sesión signs out and goes to the login', async () => {
    auth.signOut.mockResolvedValue({ success: true });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { signOut, fixture } = buttons();
    signOut.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it("says clearly when the server lacks this version's migrations (never a blank screen)", () => {
    failureKey.set('accountError.outdated');
    const { fixture } = buttons();
    expect(fixture.nativeElement.textContent).toContain('accountError.outdated');
  });
});
