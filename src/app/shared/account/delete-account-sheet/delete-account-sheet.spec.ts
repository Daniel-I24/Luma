import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountReauthService } from '@core/auth/account-reauth.service';
import { AuthErrors } from '@core/auth/auth-error';
import { AuthService } from '@core/auth/auth.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { DeleteAccountSheet } from './delete-account-sheet';

describe('DeleteAccountSheet', () => {
  const reauth = { sendCode: vi.fn(), verifyCode: vi.fn() };
  const auth = { user: signal({ id: 'u1', email: 'ana@example.com' }), deleteAccount: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    reauth.sendCode.mockResolvedValue({ success: true });
    reauth.verifyCode.mockResolvedValue({ success: true });
    auth.deleteAccount.mockResolvedValue({ success: true });
    TestBed.configureTestingModule({
      imports: [
        DeleteAccountSheet,
        TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } }),
      ],
      providers: [
        { provide: AccountReauthService, useValue: reauth },
        { provide: AuthService, useValue: auth },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(DeleteAccountSheet);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = (key: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(key));
    const settle = async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const type = async (code: string) => {
      const input = el.querySelector<HTMLInputElement>('#delete-account-code')!;
      input.value = code;
      input.dispatchEvent(new Event('input'));
      await settle();
    };
    return { el, button, settle, type };
  }

  it('shows the consequences first and deletes only after a valid e-mail code', async () => {
    const { el, button, settle, type } = await render();
    expect(el.textContent).toContain('profile.deleteSheet.items.businesses');
    expect(button('profile.deleteSheet.confirm')).toBeUndefined();

    button('profile.deleteSheet.sendCode')!.click();
    await settle();
    expect(reauth.sendCode).toHaveBeenCalledWith('ana@example.com');
    expect(auth.deleteAccount).not.toHaveBeenCalled();
    expect(button('profile.deleteSheet.confirm')!.disabled).toBe(true);

    await type('123456');
    button('profile.deleteSheet.confirm')!.click();
    await settle();
    expect(reauth.verifyCode).toHaveBeenCalledWith('ana@example.com', '123456');
    expect(auth.deleteAccount).toHaveBeenCalledTimes(1);
  });

  it('a wrong code never deletes and says why', async () => {
    reauth.verifyCode.mockResolvedValue({ success: false, errorKey: 'auth.errors.codeInvalid' });
    const { el, button, settle, type } = await render();
    button('profile.deleteSheet.sendCode')!.click();
    await settle();
    await type('000000');
    button('profile.deleteSheet.confirm')!.click();
    await settle();

    expect(auth.deleteAccount).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('auth.errors.codeInvalid');
  });

  it('a failed send stays on the consequences with its message', async () => {
    reauth.sendCode.mockResolvedValue({ success: false, errorKey: 'auth.errors.tooManyRequests' });
    const { el, button, settle } = await render();
    button('profile.deleteSheet.sendCode')!.click();
    await settle();

    expect(el.querySelector('#delete-account-code')).toBeNull();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('auth.errors.tooManyRequests');
  });
});

describe('AuthErrors.mapDeleteAccountError: one message per cause', () => {
  const http = (status: number, body: object = {}) =>
    new FunctionsHttpError(new Response(JSON.stringify(body), { status }));

  it.each([
    [http(403, { error: 'reauth_required' }), 'auth.errors.reauthRequired'],
    [http(401), 'auth.errors.sessionExpired'],
    [http(404), 'auth.errors.deleteAccountUnavailable'],
    [http(403, { error: 'origin_not_allowed' }), 'auth.errors.deleteAccountUnavailable'],
    [http(500, { error: 'delete_failed' }), 'auth.errors.deleteAccountServer'],
    [new FunctionsRelayError({}), 'auth.errors.deleteAccountServer'],
    [new FunctionsFetchError(new Error()), 'errors.serviceUnavailable'],
    [http(418), 'auth.errors.deleteAccountFailed'],
  ])('%#', async (error, key) => {
    expect(await AuthErrors.mapDeleteAccountError(error, true)).toBe(key);
  });
});

describe('AccountReauthService', () => {
  const client = { auth: { signInWithOtp: vi.fn(), verifyOtp: vi.fn() } };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: { client } }] });
  });

  it('never creates a user and verifies the e-mail code', async () => {
    client.auth.signInWithOtp.mockResolvedValue({ error: null });
    client.auth.verifyOtp.mockResolvedValue({ error: null });
    const service = TestBed.inject(AccountReauthService);

    expect((await service.sendCode('ana@example.com')).success).toBe(true);
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'ana@example.com', options: { shouldCreateUser: false } });
    expect((await service.verifyCode('ana@example.com', '123456')).success).toBe(true);
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ email: 'ana@example.com', token: '123456', type: 'email' });
  });

  it('maps an expired code and refuses a malformed one without calling Supabase', async () => {
    client.auth.verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });
    const service = TestBed.inject(AccountReauthService);

    expect((await service.verifyCode('ana@example.com', '12')).success).toBe(false);
    expect(client.auth.verifyOtp).not.toHaveBeenCalled();
    expect((await service.verifyCode('ana@example.com', '123456')).errorKey).toBe('auth.errors.codeInvalid');
  });
});
