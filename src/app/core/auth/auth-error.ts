import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

/** Maps a delete-account Edge Function error to a Transloco key. */
export async function mapDeleteAccountError(error: unknown): Promise<string> {
  if (error instanceof FunctionsFetchError) return 'auth.errors.networkError';
  if (error instanceof FunctionsHttpError) {
    const response: unknown = error.context;
    if (response instanceof Response && response.status === 401) {
      return 'auth.errors.sessionExpired';
    }
    // 403 reauth_required: the last sign-in is older than 10 minutes.
    if (response instanceof Response && response.status === 403) {
      const body: unknown = await response.json().catch(() => null);
      if (isErrorBody(body, 'reauth_required')) return 'auth.errors.reauthRequired';
    }
  }
  return 'auth.errors.deleteAccountFailed';
}

function isErrorBody(body: unknown, code: string): boolean {
  return typeof body === 'object' && body !== null && 'error' in body && body.error === code;
}

/**
 * Maps Supabase error messages / codes to Transloco i18n keys.
 * All user-facing strings live in es.json / en.json under auth.errors.*.
 */
export function mapAuthError(message: string): string {
  const msg = message.toLowerCase();

  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return 'auth.errors.invalidCredentials';
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'auth.errors.emailAlreadyRegistered';
  }
  if (msg.includes('token has expired or is invalid') || msg.includes('otp_expired')) {
    return 'auth.errors.codeInvalid';
  }
  if (msg.includes('email not confirmed')) {
    return 'auth.errors.emailNotConfirmed';
  }
  if (msg.includes('password should be at least')) {
    return 'auth.errors.passwordTooShort';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'auth.errors.tooManyRequests';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'auth.errors.networkError';
  }

  return 'auth.errors.unknown';
}
