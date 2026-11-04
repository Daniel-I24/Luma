// zod/mini: same validation as zod, tree-shakable (auth is in the initial bundle).
import * as z from 'zod/mini';
import { PasswordPolicy } from '@core/validation/password-policy';

/** Length of the codes Supabase emails ({{ .Token }}). */
export const CODE_LENGTH = 6;

export const emailSchema = z
  .string()
  .check(
    // Phone keyboards capitalize the first letter and add a space: an email is compared in lower case.
    z.trim(),
    z.toLowerCase(),
    z.minLength(1, 'auth.validation.emailRequired'),
    z.email('auth.validation.emailInvalid'),
  );

/** For signing in: any existing password (older accounts may have 6 characters). */
const currentPasswordSchema = z.string().check(z.minLength(1, 'auth.validation.passwordRequired'));

/** New passwords: the required parts of PasswordPolicy (the forms add PasswordRules). */
export const newPasswordSchema = z
  .string()
  .check(z.refine((password) => PasswordPolicy.meetsRequired(password), 'auth.validation.passwordWeak'));

const codeSchema = z
  .string()
  .check(z.regex(new RegExp(`^\\d{${CODE_LENGTH}}$`), 'auth.validation.codeInvalid'));

export const signInSchema = z.object({ email: emailSchema, password: currentPasswordSchema });
export const signUpSchema = z.object({ email: emailSchema, password: newPasswordSchema });
export const resetPasswordSchema = z.object({ email: emailSchema });
export const verifyCodeSchema = z.object({ email: emailSchema, code: codeSchema });

/** AuthCode — normalises the 6-digit codes users type or paste. */
export class AuthCode {
  /** Keeps the digits of a typed or pasted code ("123 456" → "123456"), at most 6. */
  public static normalizeCode(value: string): string {
    return value.replace(/\D/g, '').slice(0, CODE_LENGTH);
  }
}

