import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { HTTP_STATUS } from '@core/config/http-status';

/** Message fragments (lower case) of Supabase auth errors and their translation keys, in priority order. */
const AUTH_ERROR_RULES: readonly (readonly [readonly string[], string])[] = [
  [['invalid login credentials', 'invalid credentials'], 'auth.errors.invalidCredentials'],
  [['user already registered', 'already been registered'], 'auth.errors.emailAlreadyRegistered'],
  // Supabase answers the same error for a wrong and an expired code.
  [['token has expired or is invalid', 'otp_expired', 'reauthentication', 'nonce'], 'auth.errors.codeInvalid'],
  [['email not confirmed'], 'auth.errors.emailNotConfirmed'],
  [['password should be at least'], 'auth.errors.passwordTooShort'],
  [['rate limit', 'too many requests', 'for security purposes'], 'auth.errors.tooManyRequests'],
  [['should be different from the old password'], 'account.password.same'],
];

/** AuthErrors — maps Supabase auth errors to translation keys. */
export class AuthErrors {
  /** No answer from the server: the device is offline, or the service is down. */
  public static networkErrorKey(online: boolean): string {
    return online ? 'errors.serviceUnavailable' : 'errors.offline';
  }

  /** Maps a delete-account Edge Function error to a Transloco key. */
  public static async mapDeleteAccountError(error: unknown, online = true): Promise<string> {
    if (error instanceof FunctionsFetchError) return AuthErrors.networkErrorKey(online);
    if (error instanceof FunctionsHttpError) {
      const response: unknown = error.context;
      if (response instanceof Response && response.status === HTTP_STATUS.unauthorized) {
        return 'auth.errors.sessionExpired';
      }
      // 403 reauth_required: the last sign-in is older than 10 minutes.
      if (response instanceof Response && response.status === HTTP_STATUS.forbidden) {
        const body: unknown = await response.json().catch(() => null);
        if (isErrorBody(body, 'reauth_required')) return 'auth.errors.reauthRequired';
      }
    }
    return 'auth.errors.deleteAccountFailed';
  }

  /**
   * Maps Supabase error messages / codes to Transloco i18n keys.
   * All user-facing strings live in es.json / en.json under auth.errors.*.
   */
  public static mapAuthError(message: string, online = true): string {
    const msg = message.toLowerCase();
    const known = AUTH_ERROR_RULES.find(([fragments]) => fragments.some((fragment) => msg.includes(fragment)));
    if (known) return known[1];
    if (msg.includes('network') || msg.includes('fetch')) return AuthErrors.networkErrorKey(online);
    return 'auth.errors.unknown';
  }
}

function isErrorBody(body: unknown, code: string): boolean {
  return typeof body === 'object' && body !== null && 'error' in body && body.error === code;
}
