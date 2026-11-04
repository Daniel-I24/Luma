import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthCodeService } from '@core/auth/auth-code.service';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { PASSWORD_VECTORS } from '../../../../../testing/password-vectors';
import { ForgotPasswordPage } from './forgot-password.page';

const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('ForgotPasswordPage', () => {
  const codes = { requestRecoveryCode: vi.fn(), verifyRecoveryCode: vi.fn(), setRecoveredPassword: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [
        ForgotPasswordPage,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: AuthCodeService, useValue: codes },
        { provide: SessionProfileStore, useValue: { landingPath: () => Promise.resolve('/map') } },
      ],
    });
  });

  it('email, then the code (checked first), then the password with its confirmation; then signs in', async () => {
    codes.requestRecoveryCode.mockResolvedValue({ success: true });
    codes.verifyRecoveryCode.mockResolvedValue({ success: true });
    codes.setRecoveredPassword.mockResolvedValue({ success: true });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const type = (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const submit = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await flush();
      fixture.detectChanges();
    };

    type('recover-email', PASSWORD_VECTORS.email);
    await submit();
    expect(codes.requestRecoveryCode).toHaveBeenCalledWith(PASSWORD_VECTORS.email);
    expect(el.querySelector('#recover-password')).toBeNull();

    type('recover-code', '654 321');
    await submit();
    expect(codes.verifyRecoveryCode).toHaveBeenCalledWith(PASSWORD_VECTORS.email, '654321');
    expect(el.querySelector('#recover-password-checklist')).not.toBeNull();

    // Every refused vector stops the form; the confirmation must match.
    for (const [password] of PASSWORD_VECTORS.invalid) {
      type('recover-password', password);
      type('recover-password-confirm', password);
      await submit();
    }
    type('recover-password', PASSWORD_VECTORS.valid[0]);
    type('recover-password-confirm', 'otra');
    await submit();
    expect(el.textContent).toContain('auth.password.mismatch');
    expect(codes.setRecoveredPassword).not.toHaveBeenCalled();

    type('recover-password-confirm', PASSWORD_VECTORS.valid[0]);
    await submit();
    expect(codes.setRecoveredPassword).toHaveBeenCalledWith(PASSWORD_VECTORS.valid[0]);
    expect(navigate).toHaveBeenCalledWith('/map');
  });
});
