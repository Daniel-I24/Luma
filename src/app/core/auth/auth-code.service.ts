import { Injectable, inject, signal } from '@angular/core';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { AuthErrors } from './auth-error';
import { recoverPasswordSchema, resetPasswordSchema, verifyCodeSchema } from './auth.schemas';
import { type AuthResult, OK, AuthResults } from './auth.service';

/** Errors that may be shown without revealing whether an account exists. */
const NEUTRAL_ERRORS = new Set([
  'auth.errors.tooManyRequests',
  'errors.offline',
  'errors.serviceUnavailable',
]);

/**
 * AuthCodeService — email flows with 6-digit codes ({{ .Token }} in the
 * Supabase templates), never with links: confirm a new account, resend the
 * code, and reset a password. Messages never reveal whether an email has an
 * account (only rate-limit and network errors are surfaced).
 */
@Injectable({ providedIn: 'root' })
export class AuthCodeService {
  private readonly auth = inject(SupabaseService).client.auth;
  private readonly online = inject(ConnectivityService).online;
  private readonly _busy = signal(false);
  public readonly busy = this._busy.asReadonly();

  /** Confirms a new account; on success the user is signed in. */
  public confirmSignup(email: string, code: string): Promise<AuthResult> {
    const parsed = verifyCodeSchema.safeParse({ email, code });
    if (!parsed.success) return Promise.resolve(AuthResults.fail(parsed.error.issues[0].message));
    return this.run(async () => {
      const { error } = await this.auth.verifyOtp({
        email: parsed.data.email,
        token: parsed.data.code,
        type: 'signup',
      });
      return error ? AuthResults.fail(AuthErrors.mapAuthError(error, this.online())) : OK;
    });
  }

  /** Sends a new sign-up confirmation code to the e-mail (neutral answer if the address is unknown). */
  public resendSignupCode(email: string): Promise<AuthResult> {
    return this.neutral(email, (address) => this.auth.resend({ type: 'signup', email: address }));
  }

  /** Emails a recovery code; succeeds whether or not the email has an account. */
  public requestRecoveryCode(email: string): Promise<AuthResult> {
    return this.neutral(email, (address) => this.auth.resetPasswordForEmail(address));
  }

  /** Checks the recovery code (which signs the user in) and sets the new password. */
  public recoverPassword(email: string, code: string, password: string): Promise<AuthResult> {
    const parsed = recoverPasswordSchema.safeParse({ email, code, password });
    if (!parsed.success) return Promise.resolve(AuthResults.fail(parsed.error.issues[0].message));
    return this.run(async () => {
      const verified = await this.auth.verifyOtp({
        email: parsed.data.email,
        token: parsed.data.code,
        type: 'recovery',
      });
      if (verified.error) return AuthResults.fail(AuthErrors.mapAuthError(verified.error, this.online()));
      const { error } = await this.auth.updateUser({ password: parsed.data.password });
      return error ? AuthResults.fail(AuthErrors.mapAuthError(error, this.online())) : OK;
    });
  }

  private neutral(
    email: string,
    send: (email: string) => Promise<{ error: { message: string } | null }>,
  ): Promise<AuthResult> {
    const parsed = resetPasswordSchema.safeParse({ email });
    if (!parsed.success) return Promise.resolve(AuthResults.fail(parsed.error.issues[0].message));
    return this.run(async () => {
      const { error } = await send(parsed.data.email);
      const key = error ? AuthErrors.mapAuthError(error, this.online()) : null;
      return key && NEUTRAL_ERRORS.has(key) ? AuthResults.fail(key) : OK;
    });
  }

  private async run(operation: () => Promise<AuthResult>): Promise<AuthResult> {
    this._busy.set(true);
    try {
      return await operation();
    } catch {
      return AuthResults.fail('auth.errors.unknown');
    } finally {
      this._busy.set(false);
    }
  }
}
