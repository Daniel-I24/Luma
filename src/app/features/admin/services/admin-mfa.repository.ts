import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';

/** A new authenticator to add: the secret is shown once, for manual entry. */
export interface TotpEnrollment {
  readonly factorId: string;
  readonly secret: string;
}

/** Outcome of an MFA call: the value, or a translation key. */
export type MfaResult<T> =
  | { readonly data: T; readonly errorKey: null }
  | { readonly data: null; readonly errorKey: string };

const FRIENDLY_NAME = 'Luma admin';

/**
 * AdminMfaRepository — TOTP for the review team (Supabase Auth MFA). A
 * verified code raises the session to aal2, which is_admin() requires.
 * The app never logs or stores the secret.
 */
@Injectable({ providedIn: 'root' })
export class AdminMfaRepository {
  private readonly auth = inject(SupabaseService).client.auth;

  /** Id of the verified TOTP factor, or null when the admin has none yet. */
  public async verifiedFactor(): Promise<MfaResult<string | null>> {
    const { data, error } = await this.auth.mfa.listFactors();
    if (error) return { data: null, errorKey: 'admin.mfa.errors.loadFailed' };
    return { data: data.totp.find((factor) => factor.status === 'verified')?.id ?? null, errorKey: null };
  }

  /** Starts a new authenticator; unfinished ones are removed first. */
  public async enroll(): Promise<MfaResult<TotpEnrollment>> {
    const listed = await this.auth.mfa.listFactors();
    if (listed.error) return { data: null, errorKey: 'admin.mfa.errors.loadFailed' };
    const unfinished = listed.data.all.filter((f) => f.factor_type === 'totp' && f.status !== 'verified');
    for (const factor of unfinished) await this.auth.mfa.unenroll({ factorId: factor.id });
    const { data, error } = await this.auth.mfa.enroll({ factorType: 'totp', friendlyName: FRIENDLY_NAME });
    if (error) return { data: null, errorKey: 'admin.mfa.errors.enrollFailed' };
    return { data: { factorId: data.id, secret: data.totp.secret }, errorKey: null };
  }

  /** Checks a 6-digit code; on success the session is aal2. */
  public async verify(factorId: string, code: string): Promise<MfaResult<true>> {
    const { error } = await this.auth.mfa.challengeAndVerify({ factorId, code });
    return error ? { data: null, errorKey: 'admin.mfa.errors.invalidCode' } : { data: true, errorKey: null };
  }
}
