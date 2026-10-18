import { MIN_PASSWORD_LENGTH, PASSWORD_PATTERN } from '@core/auth/auth.schemas';
import { isCommonPassword } from './common-passwords';

export type PasswordStrength = 'empty' | 'weak' | 'fair' | 'strong';

/**
 * Rough strength for the meter (never the rule itself, which is
 * newPasswordSchema plus the common-password list): length and variety.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return 'empty';
  if (
    password.length < MIN_PASSWORD_LENGTH ||
    !PASSWORD_PATTERN.test(password) ||
    isCommonPassword(password)
  ) {
    return 'weak';
  }
  const variety = [/\p{Ll}/u, /\p{Lu}/u, /\d/, /[^\p{L}\d]/u].filter((re) =>
    re.test(password),
  ).length;
  return password.length >= 12 && variety >= 3 ? 'strong' : 'fair';
}
