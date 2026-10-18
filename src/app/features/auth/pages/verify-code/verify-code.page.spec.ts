import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthCodeService } from '@core/auth/auth-code.service';
import { PendingVerification } from '@core/auth/pending-verification';
import { RESEND_COOLDOWN_SECONDS, VerifyCodePage } from './verify-code.page';

const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('VerifyCodePage', () => {
  const codes = { confirmSignup: vi.fn(), resendSignupCode: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [
        VerifyCodePage,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [provideRouter([]), { provide: AuthCodeService, useValue: codes }],
    });
  });

  afterEach(() => vi.useRealTimers());

  function render(email: string | null = 'ana@example.com') {
    if (email) TestBed.inject(PendingVerification).set(email);
    const fixture = TestBed.createComponent(VerifyCodePage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const type = (value: string) => {
      const input = el.querySelector<HTMLInputElement>('#verify-code')!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, el, type };
  }

  it('is a numeric one-time-code field and the email never goes in the URL', () => {
    const { el } = render();
    const input = el.querySelector('#verify-code')!;

    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(el.querySelector('#verify-email')).toBeNull();
  });

  it('sends the code as soon as 6 digits are pasted, then opens the app', async () => {
    codes.confirmSignup.mockResolvedValue({ success: true });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { type } = render();

    type('12 34 56');
    await flush();

    expect(codes.confirmSignup).toHaveBeenCalledWith('ana@example.com', '123456');
    expect(navigate).toHaveBeenCalledWith(['/map']);
    expect(TestBed.inject(PendingVerification).email()).toBeNull();
  });

  it('shows the translated error for a wrong or expired code', async () => {
    codes.confirmSignup.mockResolvedValue({ success: false, errorKey: 'auth.errors.codeInvalid' });
    const { fixture, el, type } = render();

    type('000000');
    await flush();
    fixture.detectChanges();

    expect(el.textContent).toContain('auth.errors.codeInvalid');
  });

  it(`waits ${RESEND_COOLDOWN_SECONDS} s before offering a new code`, async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    codes.resendSignupCode.mockResolvedValue({ success: true });
    const { fixture, el } = render();
    const resend = () =>
      Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('auth.verify.resend'),
      )!;

    expect(resend().disabled).toBe(true);
    vi.advanceTimersByTime(RESEND_COOLDOWN_SECONDS * 1000);
    fixture.detectChanges();
    expect(resend().disabled).toBe(false);

    resend().click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    expect(codes.resendSignupCode).toHaveBeenCalledWith('ana@example.com');
    expect(resend().disabled).toBe(true);
  });

  it('asks for the email when it is not known (after a reload)', () => {
    const { el } = render(null);

    expect(el.querySelector('#verify-email')).not.toBeNull();
  });
});
