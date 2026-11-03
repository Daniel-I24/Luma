import { Injectable, inject } from '@angular/core';
import { AuthErrors } from '@core/auth/auth-error';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { Phone } from './phone';

/**
 * PhoneVerificationService — proves the user owns their mobile: Supabase
 * sends a 6-digit SMS code (phone change), the code is checked and the
 * database copies the confirmed number to the profile (sync_verified_phone).
 * Results are translation keys, never raw errors.
 */
@Injectable({ providedIn: 'root' })
export class PhoneVerificationService {
  private readonly auth = inject(SupabaseService).client.auth;
  private readonly db = inject(SupabaseService).client;

  /** Asks Supabase to send the code; null on success, otherwise an error key. */
  public async sendCode(phone: Phone): Promise<string | null> {
    const { error } = await this.auth.updateUser({ phone: phone.e164 });
    return error ? PhoneVerificationService.keyOf(error.message, 'phoneVerification.errors.sendFailed') : null;
  }

  /** Checks the code and saves the verified number; null on success, otherwise an error key. */
  public async confirm(phone: Phone, code: string): Promise<string | null> {
    const verified = await this.auth.verifyOtp({ phone: phone.e164, token: code.trim(), type: 'phone_change' });
    if (verified.error) return PhoneVerificationService.keyOf(verified.error.message, 'auth.errors.codeInvalid');
    const { error } = await this.db.rpc('sync_verified_phone');
    return error ? 'errors.phoneNotVerified' : null;
  }

  private static keyOf(message: string, fallback: string): string {
    const key = AuthErrors.mapAuthError(message);
    return key === 'auth.errors.unknown' ? fallback : key;
  }
}
