import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthCodeService } from '@core/auth/auth-code.service';
import { AuthService } from '@core/auth/auth.service';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  const auth = { signIn: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [LoginPage, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [
        provideRouter([{ path: 'map', children: [] }]),
        { provide: AuthService, useValue: auth },
        { provide: AuthCodeService, useValue: { resendSignupCode: vi.fn() } },
        { provide: SessionProfileStore, useValue: { landingPath: vi.fn().mockResolvedValue('/map') } },
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const field = (id: string) => el.querySelector<HTMLInputElement>(`#${id}`)!;
    const type = (id: string, value: string) => {
      field(id).value = value;
      field(id).dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, el, field, type };
  }

  it('the email is typed exactly: no capitals, corrections or spell check; the right keyboard and autofill', () => {
    const { field } = render();
    const email = field('login-email');
    expect([email.type, email.getAttribute('inputmode'), email.getAttribute('autocomplete')]).toEqual(['email', 'email', 'username']);
    expect([email.getAttribute('autocapitalize'), email.getAttribute('autocorrect'), email.getAttribute('spellcheck')]).toEqual(['none', 'off', 'false']);
    expect(field('login-password').getAttribute('autocomplete')).toBe('current-password');
  });

  it('shows and hides the password without changing it, and sends it as typed', async () => {
    auth.signIn.mockResolvedValue({ success: true });
    const { fixture, el, field, type } = render();
    type('login-email', 'ana@correo.com');
    type('login-password', ' clave ');
    const toggle = el.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
    expect(toggle.getAttribute('aria-label')).toBe('auth.signup.credentials.showPassword');
    toggle.click();
    fixture.detectChanges();
    expect([field('login-password').type, field('login-password').getAttribute('autocapitalize')]).toEqual(['text', 'none']);
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await vi.waitFor(() => expect(auth.signIn).toHaveBeenCalledWith('ana@correo.com', ' clave '));
  });

  it('a refused sign-in shows our own message, and "¿Olvidaste tu contraseña?" opens the code flow', async () => {
    auth.signIn.mockResolvedValue({ success: false, errorKey: 'auth.errors.invalidCredentials' });
    const { fixture, el, type } = render();
    type('login-email', 'ana@correo.com');
    type('login-password', 'x');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('auth.errors.invalidCredentials');
    });
    expect(el.querySelector('a[href="/auth/forgot-password"]')).not.toBeNull();
  });
});
