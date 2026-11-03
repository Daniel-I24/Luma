import { MIN_PASSWORD_LENGTH, PASSWORD_PATTERN } from '@core/auth/auth.schemas';
import { CommonPasswords } from './common-passwords';

const STRONG_LENGTH = 12;
/** Character classes (lower, upper, digit, symbol) a strong password mixes. */
const STRONG_VARIETY = 3;

export type PasswordStrength = 'empty' | 'weak' | 'fair' | 'strong';

/** PasswordStrengthMeter — scores a password for the strength bar. */
export class PasswordStrengthMeter {
  /**
   * Rough strength for the meter (never the rule itself, which is
   * newPasswordSchema plus the common-password list): length and variety.
   */
  public static passwordStrength(password: string): PasswordStrength {
    if (!password) return 'empty';
    if (
      password.length < MIN_PASSWORD_LENGTH ||
      !PASSWORD_PATTERN.test(password) ||
      CommonPasswords.isCommonPassword(password)
    ) {
      return 'weak';
    }
    const variety = [/\p{Ll}/u, /\p{Lu}/u, /\d/, /[^\p{L}\d]/u].filter((re) =>
      re.test(password),
    ).length;
    return password.length >= STRONG_LENGTH && variety >= STRONG_VARIETY ? 'strong' : 'fair';
  }
}

