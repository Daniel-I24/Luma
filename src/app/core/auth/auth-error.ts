import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { HTTP_STATUS } from '@core/config/http-status';

/** Shape of an operation result returned by every auth method. */
export interface AuthResult {
  success: boolean;
  /** Transloco key for an error message, present when success is false. */
  errorKey?: string;
}

export const OK: AuthResult = { success: true };

/** AuthResults — the failed result of an auth operation, with its translation key. */
export class AuthResults {
  public static readonly fail = (errorKey: string): AuthResult => ({ success: false, errorKey });
  /** The first validation message (a translation key), or the generic one. */
  public static readonly invalid = (error: { readonly issues: readonly { readonly message: string }[] }): AuthResult =>
    AuthResults.fail(error.issues[0]?.message ?? 'auth.errors.unknown');
}

/** What Supabase answers: an AuthError (code, status, name) or just its message. */
export type AuthErrorLike = string | { readonly message?: string; readonly code?: string; readonly status?: number; readonly name?: string };

/**
 * Supabase error codes (supabase.com/docs/guides/auth/debugging/error-codes)
 * and their messages. A wrong password and an unknown email give the same
 * message: the app never tells whether an account exists.
 */
const AUTH_ERROR_CODES: Readonly<Record<string, string>> = {
  invalid_credentials: 'auth.errors.invalidCredentials',
  user_not_found: 'auth.errors.invalidCredentials',
  email_not_confirmed: 'auth.errors.emailNotConfirmed',
  over_request_rate_limit: 'auth.errors.tooManyRequests',
  over_email_send_rate_limit: 'auth.errors.tooManyRequests',
  over_sms_send_rate_limit: 'auth.errors.tooManyRequests',
  otp_expired: 'auth.errors.codeInvalid',
  user_already_exists: 'auth.errors.emailAlreadyRegistered',
  email_exists: 'auth.errors.emailAlreadyRegistered',
  weak_password: 'auth.errors.passwordTooShort',
  same_password: 'account.password.same',
};

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

  /**
   * Maps a delete-account Edge Function error to its own message: no
   * connection, session expired, a sign-in too old (reauth_required), the
   * function not deployed or refusing this origin (unavailable), or a server failure.
   */
  public static async mapDeleteAccountError(error: unknown, online = true): Promise<string> {
    if (error instanceof FunctionsFetchError) return AuthErrors.networkErrorKey(online);
    if (error instanceof FunctionsRelayError) return 'auth.errors.deleteAccountServer';
    if (!(error instanceof FunctionsHttpError) || !(error.context instanceof Response)) return 'auth.errors.deleteAccountFailed';
    return AuthErrors.deleteAccountHttpError(error.context);
  }

  /** The answer of delete-account: status first, then the error code of its body. */
  private static async deleteAccountHttpError(response: Response): Promise<string> {
    if (response.status === HTTP_STATUS.unauthorized) return 'auth.errors.sessionExpired';
    const body: unknown = await response.json().catch(() => null);
    // 403 reauth_required: the last sign-in is older than 10 minutes.
    if (isErrorBody(body, 'reauth_required')) return 'auth.errors.reauthRequired';
    if (response.status === HTTP_STATUS.notFound || isErrorBody(body, 'origin_not_allowed')) {
      return 'auth.errors.deleteAccountUnavailable';
    }
    if (response.status >= HTTP_STATUS.serverError) return 'auth.errors.deleteAccountServer';
    return 'auth.errors.deleteAccountFailed';
  }

  /**
   * Maps a Supabase auth error (its code first, then its message) to a
   * Transloco key under auth.errors.*; no answer at all is a network error.
   */
  public static mapAuthError(error: AuthErrorLike, online = true): string {
    const { message = '', code, status, name } = typeof error === 'string' ? { message: error } : error;
    const byCode = AUTH_ERROR_CODES[code ?? ''];
    if (byCode) return byCode;
    if (name === 'AuthRetryableFetchError' || status === 0) return AuthErrors.networkErrorKey(online);
    return AuthErrors.byMessage(message, online);
  }

  /** The older errors carry no code: their message decides. */
  private static byMessage(message: string, online: boolean): string {
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
