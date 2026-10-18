// zod/mini: same validation as zod, tree-shakable (auth is in the initial bundle).
import * as z from 'zod/mini';

/** New passwords: at least 8 characters with letters and numbers. */
export const MIN_PASSWORD_LENGTH = 8;
/** Length of the codes Supabase emails ({{ .Token }}). */
export const CODE_LENGTH = 6;

const emailSchema = z
  .string()
  .check(
    z.trim(),
    z.minLength(1, 'auth.validation.emailRequired'),
    z.email('auth.validation.emailInvalid'),
  );

/** For signing in: any existing password (older accounts may have 6 characters). */
const currentPasswordSchema = z.string().check(z.minLength(1, 'auth.validation.passwordRequired'));

/** At least one letter (any alphabet) and one digit. */
export const PASSWORD_PATTERN = /^(?=.*\p{L})(?=.*\d).+$/u;

export const newPasswordSchema = z
  .string()
  .check(
    z.minLength(MIN_PASSWORD_LENGTH, 'auth.validation.passwordWeak'),
    z.regex(PASSWORD_PATTERN, 'auth.validation.passwordWeak'),
  );

export const codeSchema = z
  .string()
  .check(z.regex(new RegExp(`^\\d{${CODE_LENGTH}}$`), 'auth.validation.codeInvalid'));

export const signInSchema = z.object({ email: emailSchema, password: currentPasswordSchema });
export const signUpSchema = z.object({ email: emailSchema, password: newPasswordSchema });
export const resetPasswordSchema = z.object({ email: emailSchema });
export const verifyCodeSchema = z.object({ email: emailSchema, code: codeSchema });
export const recoverPasswordSchema = z.object({
  email: emailSchema,
  code: codeSchema,
  password: newPasswordSchema,
});

/** Keeps the digits of a typed or pasted code ("123 456" → "123456"), at most 6. */
export function normalizeCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, CODE_LENGTH);
}
