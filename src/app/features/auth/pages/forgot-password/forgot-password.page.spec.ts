import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthCodeService } from '@core/auth/auth-code.service';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { ForgotPasswordPage } from './forgot-password.page';

const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('ForgotPasswordPage', () => {
  const codes = { requestRecoveryCode: vi.fn(), recoverPassword: vi.fn() };

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
        { provide: SessionProfileStore, useValue: { homePath: () => Promise.resolve('/map') } },
      ],
    });
  });

  it('asks for the email, then for the code and the new password, then signs in', async () => {
    codes.requestRecoveryCode.mockResolvedValue({ success: true });
    codes.recoverPassword.mockResolvedValue({ success: true });
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

    type('recover-email', 'ana@example.com');
    await submit();
    expect(codes.requestRecoveryCode).toHaveBeenCalledWith('ana@example.com');
    expect(el.textContent).toContain('auth.forgotPassword.codeSent');

    type('recover-code', '654 321');
    type('recover-password', 'nueva2026');
    await submit();

    expect(codes.recoverPassword).toHaveBeenCalledWith('ana@example.com', '654321', 'nueva2026');
    expect(navigate).toHaveBeenCalledWith('/map');
  });
});
