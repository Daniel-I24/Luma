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

/**
 * PasswordChangeService — changes the signed-in user's password. The current
 * password is checked first (signing in again with it), so an unlocked phone
 * left on the table is not enough to take over the account.
 */
@Injectable({ providedIn: 'root' })
export class PasswordChangeService {
  private readonly auth = inject(SupabaseService).client.auth;
  private readonly online = inject(ConnectivityService).online;
  private readonly _busy = signal(false);
  public readonly busy = this._busy.asReadonly();

  /** Changes the password after re-checking the current one. */
  public async change(current: string, next: string): Promise<AuthResult> {
    const parsed = changeSchema.safeParse({ current, next });
    if (!parsed.success) return AuthResults.fail(parsed.error.issues[0].message);
    this._busy.set(true);
    try {
      const { data } = await this.auth.getUser();
      const email = data.user?.email;
      if (!email) return AuthResults.fail('auth.errors.sessionExpired');
      const check = await this.auth.signInWithPassword({ email, password: parsed.data.current });
      if (check.error) {
        const key = AuthErrors.mapAuthError(check.error.message, this.online());
        return AuthResults.fail(key === 'auth.errors.invalidCredentials' ? 'account.password.wrongCurrent' : key);
      }
      const { error } = await this.auth.updateUser({ password: parsed.data.next });
      return error ? AuthResults.fail(AuthErrors.mapAuthError(error.message, this.online())) : OK;
    } catch {
      return AuthResults.fail('auth.errors.unknown');
    } finally {
      this._busy.set(false);
    }
  }
}
