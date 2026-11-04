/** Supabase Auth hashes at most 72 bytes of a password. */
export const PASSWORD_MAX = 72;
const PASSWORD_MIN = 8;

/**
 * The required parts, with ASCII classes exactly like Supabase's "lowercase,
 * uppercase letters and digits" requirement (docs/auth-emails.md).
 */
export const PASSWORD_PARTS = {
  length: (p: string) => Array.from(p).length >= PASSWORD_MIN && Array.from(p).length <= PASSWORD_MAX,
  upper: (p: string) => /[A-Z]/.test(p),
  lower: (p: string) => /[a-z]/.test(p),
  digit: (p: string) => /\d/.test(p),
} as const;

export type PasswordRequirement = keyof typeof PASSWORD_PARTS;

/**
 * PasswordPolicy — the required parts only, small enough for the initial
 * bundle (auth.schemas). PasswordRules adds the e-mail and common-password
 * checks and the advice for the forms.
 */
export class PasswordPolicy {
  /** True when every required part is there. */
  public static meetsRequired(password: string): boolean {
    return Object.values(PASSWORD_PARTS).every((part) => part(password));
  }
}
