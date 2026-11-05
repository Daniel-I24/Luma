import { Injectable, inject } from '@angular/core';
import { ErrorCode } from '@core/errors/error-code';
import { ErrorLog } from '@core/errors/error-log';
import { SupabaseService } from '@core/supabase/supabase.service';

/** A new authenticator to add: QR and secret are shown once, for the authenticator app. */
export interface TotpEnrollment {
  readonly factorId: string;
  readonly secret: string;
  /** The QR as an image URL; null when Supabase sent none (the secret still works). */
  readonly qrCode: string | null;
}

/** Outcome of an MFA call: the value, or a translation key. */
export type MfaResult<T> =
  | { readonly data: T; readonly errorKey: null }
  | { readonly data: null; readonly errorKey: string };

const FRIENDLY_NAME = 'Luma admin';
const SVG_DATA_PREFIX = 'data:image/svg+xml;utf-8,';

/**
 * AdminMfaRepository — TOTP for the review team (Supabase Auth MFA). A
 * verified code raises the session to aal2, which is_admin() requires.
 * The app never logs or stores the secret. Nothing here rejects: each failure
 * is a translation key, and its code goes to ErrorLog.
 */
@Injectable({ providedIn: 'root' })
export class AdminMfaRepository {
  private readonly auth = inject(SupabaseService).client.auth;
  private readonly log = inject(ErrorLog);

  /** Id of the verified TOTP factor, or null when the admin has none yet. */
  public async verifiedFactor(): Promise<MfaResult<string | null>> {
    try {
      const { data, error } = await this.auth.mfa.listFactors();
      if (error) return this.failed('admin.mfa.errors.loadFailed', error);
      return { data: data.totp.find((factor) => factor.status === 'verified')?.id ?? null, errorKey: null };
    } catch (error) {
      return this.failed('admin.mfa.errors.loadFailed', error);
    }
  }

  /** Starts a new authenticator; unfinished ones are removed first. */
  public async enroll(): Promise<MfaResult<TotpEnrollment>> {
    try {
      const listed = await this.auth.mfa.listFactors();
      if (listed.error) return this.failed('admin.mfa.errors.loadFailed', listed.error);
      const unfinished = listed.data.all.filter((f) => f.factor_type === 'totp' && f.status !== 'verified');
      for (const factor of unfinished) {
        const removed = await this.auth.mfa.unenroll({ factorId: factor.id });
        if (removed.error) return this.failed('admin.mfa.errors.cleanupFailed', removed.error);
      }
      const { data, error } = await this.auth.mfa.enroll({ factorType: 'totp', friendlyName: FRIENDLY_NAME });
      if (error) return this.failed('admin.mfa.errors.enrollFailed', error);
      const qrCode = AdminMfaRepository.qrImage(data.totp.qr_code);
      return { data: { factorId: data.id, secret: data.totp.secret, qrCode }, errorKey: null };
    } catch (error) {
      return this.failed('admin.mfa.errors.enrollFailed', error);
    }
  }

  /** Checks a 6-digit code; on success the session is aal2. */
  public async verify(factorId: string, code: string): Promise<MfaResult<true>> {
    try {
      const { error } = await this.auth.mfa.challengeAndVerify({ factorId, code });
      return error ? { data: null, errorKey: 'admin.mfa.errors.invalidCode' } : { data: true, errorKey: null };
    } catch (error) {
      return this.failed('admin.mfa.errors.loadFailed', error);
    }
  }

  /** The SVG Supabase sends, as a data URL an <img> can show ('#' must be encoded). */
  public static qrImage(qr: string | undefined): string | null {
    if (!qr) return null;
    const svg = qr.startsWith(SVG_DATA_PREFIX) ? qr.slice(SVG_DATA_PREFIX.length) : qr;
    return svg.trimStart().startsWith('<') ? SVG_DATA_PREFIX + encodeURIComponent(svg) : null;
  }

  private failed(errorKey: string, error: unknown): { readonly data: null; readonly errorKey: string } {
    this.log.record(new Error(`admin_mfa: ${ErrorCode.of(error)}`), 'admin');
    return { data: null, errorKey };
  }
}
