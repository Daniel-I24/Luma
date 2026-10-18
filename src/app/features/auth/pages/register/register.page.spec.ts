import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { PendingVerification } from '@core/auth/pending-verification';
import { TERMS_VERSION } from '@shared/legal/legal-version';
import { SignupDraftStore } from '../../signup/signup-draft.store';
import { RegisterPage } from './register.page';

describe('RegisterPage (stepped sign-up)', () => {
  const auth = { signUp: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [
        RegisterPage,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    TestBed.inject(SignupDraftStore).reset();
  });

  async function render() {
    const fixture = TestBed.createComponent(RegisterPage);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const type = async (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await settle();
    };
    const click = async (selector: string) => {
      el.querySelector<HTMLElement>(selector)!.click();
      await settle();
    };
    const submit = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await settle();
    };
    const title = () => el.querySelector('#signup-step-title')?.textContent?.trim();
    return { el, type, click, submit, settle, title };
  }

  it('walks the four steps and signs up with the profile metadata', async () => {
    auth.signUp.mockResolvedValue({ success: true });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { type, click, submit, title } = await render();

    await click('input[value="business_owner"]');
    await submit();
    expect(title()).toBe('auth.signup.steps.personal');
    expect(document.activeElement?.id).toBe('signup-step-title');

    await type('signup-fullName', 'Ana Pérez');
    await type('signup-phone', '300 123 4567');
    await submit();
    await type('signup-email', 'ana@example.com');
    await type('signup-password', 'tamal-pastuso-7');
    await submit();
    expect(title()).toBe('auth.signup.steps.consent');
    await click('#signup-acceptedTerms');
    await click('#signup-acceptedPrivacy');
    await click('#signup-isAdult');
    await submit();

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith(['/auth/verify']));
    expect(auth.signUp).toHaveBeenCalledWith('ana@example.com', 'tamal-pastuso-7', {
      accountType: 'business_owner',
      fullName: 'Ana Pérez',
      phone: '+573001234567',
      acceptedTerms: true,
      termsVersion: TERMS_VERSION,
    });
    expect(TestBed.inject(PendingVerification).email()).toBe('ana@example.com');
    expect(TestBed.inject(SignupDraftStore).draft().password).toBe('');
  });

  it('shows the errors of a step and focuses the first invalid field', async () => {
    const { el, click, submit } = await render();
    await click('input[value="business_owner"]');
    await submit();

    await submit();

    expect(document.activeElement?.id).toBe('signup-fullName');
    expect(el.textContent).toContain('auth.signup.validation.fullName');
    expect(el.textContent).toContain('auth.signup.validation.phoneRequired');
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('keeps the typed data when going back', async () => {
    const { el, type, click, submit, settle, title } = await render();
    await click('input[value="customer"]');
    await submit();
    await type('signup-fullName', 'Ana Pérez');
    await submit();

    const back = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('auth.signup.back'),
    )!;
    back.click();
    await settle();

    expect(title()).toBe('auth.signup.steps.personal');
    expect(el.querySelector<HTMLInputElement>('#signup-fullName')!.value).toBe('Ana Pérez');
  });

  it('shows a translated error and stays on the last step when the sign-up fails', async () => {
    auth.signUp.mockResolvedValue({ success: false, errorKey: 'auth.errors.tooManyRequests' });
    const store = TestBed.inject(SignupDraftStore);
    const { el, submit } = await render();
    store.update('accountType', 'customer');
    store.update('fullName', 'Ana');
    store.update('email', 'ana@example.com');
    store.update('password', 'tamal2024');
    store.update('acceptedTerms', true);
    store.update('acceptedPrivacy', true);
    store.update('isAdult', true);
    for (let i = 0; i < 3; i++) await submit();

    await submit();

    await vi.waitFor(() =>
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(
        'auth.errors.tooManyRequests',
      ),
    );
    expect(store.isLast()).toBe(true);
  });
});
