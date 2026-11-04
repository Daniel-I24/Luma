import { COMMON_PASSWORDS } from './common-passwords';
import { PASSWORD_PARTS, type PasswordRequirement } from './password-policy';
import { Spec, type Specification } from './specification';

/** Recommended: this long, or a symbol. */
const RECOMMENDED_LENGTH = 12;
/** The local part of the e-mail counts only from this length ("a@x.co" would block every "a"). */
const MIN_EMAIL_PART = 3;

export const PASSWORD_REQUIREMENTS = Object.keys(PASSWORD_PARTS) as readonly PasswordRequirement[];

/** Why a password that has every part is still refused. */
export type PasswordRefusal = 'containsEmail' | 'common';

export type PasswordStrength = 'empty' | 'weak' | 'fair' | 'strong';

/** The live checklist of one password. */
export interface PasswordCheck {
  readonly met: Readonly<Record<PasswordRequirement, boolean>>;
  /** 12 characters or a symbol (advice, not required). */
  readonly recommended: boolean;
  readonly refusal: PasswordRefusal | null;
  readonly valid: boolean;
  readonly strength: PasswordStrength;
}

/**
 * PasswordRules — the one rule for new passwords (sign-up, change and
 * recovery): 8 to 72 characters with an uppercase letter, a lowercase
 * letter and a digit; never the local part of the e-mail nor one of the
 * 200 common passwords. Old passwords keep working at sign-in.
 */
export class PasswordRules {
  /** The checklist, with the e-mail of the account when it is known. */
  public static check(password: string, email = ''): PasswordCheck {
    const met = {
      length: PASSWORD_PARTS.length(password),
      upper: PASSWORD_PARTS.upper(password),
      lower: PASSWORD_PARTS.lower(password),
      digit: PASSWORD_PARTS.digit(password),
    };
    const recommended = Array.from(password).length >= RECOMMENDED_LENGTH || /[^A-Za-z\d]/.test(password);
    const refusal = PasswordRules.refusalOf(password, email);
    const valid = PASSWORD_REQUIREMENTS.every((key) => met[key]) && !refusal;
    return { met, recommended, refusal, valid, strength: PasswordRules.strengthOf(password, valid, recommended) };
  }

  /** The translation key of the first problem, or null when the password can be saved. */
  public static errorKey(password: string, email = ''): string | null {
    const check = PasswordRules.check(password, email);
    if (check.refusal) return `auth.password.refusal.${check.refusal}`;
    return check.valid ? null : 'auth.validation.passwordWeak';
  }

  /** As a specification (for FieldRules and zod checks). */
  public static spec(email = ''): Specification<string> {
    return Spec.of((password) => PasswordRules.check(password, email).valid);
  }

  private static refusalOf(password: string, email: string): PasswordRefusal | null {
    const lower = password.toLowerCase();
    const local = email.split('@')[0]?.trim().toLowerCase() ?? '';
    if (local.length >= MIN_EMAIL_PART && lower.includes(local)) return 'containsEmail';
    return COMMON_PASSWORDS.has(lower.trim()) ? 'common' : null;
  }

  private static strengthOf(password: string, valid: boolean, recommended: boolean): PasswordStrength {
    if (!password) return 'empty';
    if (!valid) return 'weak';
    return recommended ? 'strong' : 'fair';
  }
}
