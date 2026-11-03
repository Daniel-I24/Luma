import { Injectable, inject, signal } from '@angular/core';
import * as z from 'zod/mini';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { AuthErrors } from './auth-error';
import { newPasswordSchema } from './auth.schemas';
import { type AuthResult, OK, AuthResults } from './auth.service';

const changeSchema = z
  .object({
    current: z.string().check(z.minLength(1, 'auth.validation.passwordRequired')),
    next: newPasswordSchema,
  })
  .check(z.refine((v) => v.current !== v.next, { message: 'account.password.same', path: ['next'] }));

const codeSchema = z.string().check(z.regex(/^\d{6}$/, 'auth.validation.codeInvalid'));

/**
 * PasswordChangeService — changes the signed-in user's password in two
 * steps, as Supabase's "Secure password change" requires: the current
 * password is checked (signing in again with it) and Supabase e-mails a
 * reauthentication code; the new password is then saved with that code as
 * the nonce. An unlocked phone left on the table is not enough to take over
 * the account.
 */
@Injectable({ providedIn: 'root' })
export class PasswordChangeService {
  private readonly auth = inject(SupabaseService).client.auth;
  private readonly online = inject(ConnectivityService).online;
  private readonly _busy = signal(false);
  public readonly busy = this._busy.asReadonly();

  /** Step 1: checks both passwords and the current one, then e-mails the code. */
  public requestCode(current: string, next: string): Promise<AuthResult> {
    const parsed = changeSchema.safeParse({ current, next });
    if (!parsed.success) return Promise.resolve(AuthResults.fail(parsed.error.issues[0].message));
    return this.busyWhile(async () => {
      const { data } = await this.auth.getUser();
      const email = data.user?.email;
      if (!email) return AuthResults.fail('auth.errors.sessionExpired');
      const check = await this.auth.signInWithPassword({ email, password: parsed.data.current });
      if (check.error) {
        const key = AuthErrors.mapAuthError(check.error.message, this.online());
        return AuthResults.fail(key === 'auth.errors.invalidCredentials' ? 'account.password.wrongCurrent' : key);
      }
      const { error } = await this.auth.reauthenticate();
      return error ? AuthResults.fail(AuthErrors.mapAuthError(error.message, this.online())) : OK;
    });
  }

  /** Step 2: saves the new password with the e-mailed code. */
  public confirm(next: string, code: string): Promise<AuthResult> {
    const parsed = codeSchema.safeParse(code.trim());
    if (!parsed.success) return Promise.resolve(AuthResults.fail(parsed.error.issues[0].message));
    return this.busyWhile(async () => {
      const { error } = await this.auth.updateUser({ password: next, nonce: parsed.data });
      return error ? AuthResults.fail(AuthErrors.mapAuthError(error.message, this.online())) : OK;
    });
  }

  private async busyWhile(action: () => Promise<AuthResult>): Promise<AuthResult> {
    this._busy.set(true);
    try {
      return await action();
    } catch {
      return AuthResults.fail('auth.errors.unknown');
    } finally {
      this._busy.set(false);
    }
  }
}
