import { Injectable, inject } from '@angular/core';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { AuthErrors } from './auth-error';
import { verifyCodeSchema } from './auth.schemas';
import { type AuthResult, AuthResults, OK } from './auth.service';

/**
 * AccountReauthService — before an irreversible action (deleting the
 * account) the user proves again that the mailbox is theirs: a 6-digit code
 * by e-mail (signInWithOtp, never creating a user; the "Magic Link" template
 * carries {{ .Token }}, docs/auth-emails.md) and verifyOtp, which starts a
 * fresh session. delete-account accepts only sessions younger than 10 minutes.
 */
@Injectable({ providedIn: 'root' })
export class AccountReauthService {
  private readonly auth = inject(SupabaseService).client.auth;
  private readonly online = inject(ConnectivityService).online;

  /** E-mails a sign-in code to the signed-in user's own address. */
  public async sendCode(email: string): Promise<AuthResult> {
    try {
      const { error } = await this.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      return error ? AuthResults.fail(AuthErrors.mapAuthError(error.message, this.online())) : OK;
    } catch {
      return AuthResults.fail(AuthErrors.networkErrorKey(this.online()));
    }
  }

  /** Checks the code; on success the session is new (last_sign_in_at is now). */
  public async verifyCode(email: string, code: string): Promise<AuthResult> {
    const parsed = verifyCodeSchema.safeParse({ email, code });
    if (!parsed.success) return AuthResults.fail(parsed.error.issues[0].message);
    try {
      const { error } = await this.auth.verifyOtp({ email: parsed.data.email, token: parsed.data.code, type: 'email' });
      return error ? AuthResults.fail(AuthErrors.mapAuthError(error.message, this.online())) : OK;
    } catch {
      return AuthResults.fail(AuthErrors.networkErrorKey(this.online()));
    }
  }
}
