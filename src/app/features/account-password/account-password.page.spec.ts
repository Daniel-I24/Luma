import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { PasswordChangeService } from '@core/auth/password-change.service';
import { ToastService } from '@design-system';
import { PASSWORD_VECTORS } from '../../../testing/password-vectors';
import { AccountPasswordPage } from './account-password.page';

const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('AccountPasswordPage', () => {
  const passwords = { busy: signal(false), requestCode: vi.fn(), confirm: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    passwords.requestCode.mockResolvedValue({ success: true });
    TestBed.configureTestingModule({
      imports: [AccountPasswordPage, TranslocoTestingModule.forRoot({ langs: { es: {} } })],
      providers: [
        { provide: PasswordChangeService, useValue: passwords },
        { provide: AuthService, useValue: { user: signal({ email: PASSWORD_VECTORS.email }) } },
        { provide: ToastService, useValue: { show: vi.fn() } },
        { provide: Location, useValue: { back: vi.fn() } },
      ],
    });
  });

  it('sends the code only for a new password that follows PasswordRules and is repeated', async () => {
    const fixture = TestBed.createComponent(AccountPasswordPage);
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

    type('password-current', 'vieja-clave-1');
    for (const [password, key] of PASSWORD_VECTORS.invalid) {
      type('password-next', password);
      type('password-confirm', password);
      await submit();
      expect(el.textContent).toContain(key);
    }
    expect(el.querySelector('#password-next-checklist')).not.toBeNull();
    expect(passwords.requestCode).not.toHaveBeenCalled();

    type('password-next', PASSWORD_VECTORS.valid[1]);
    type('password-confirm', PASSWORD_VECTORS.valid[1]);
    await submit();
    expect(passwords.requestCode).toHaveBeenCalledWith('vieja-clave-1', PASSWORD_VECTORS.valid[1]);
  });
});
