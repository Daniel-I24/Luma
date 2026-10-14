// zod/mini: same validation as zod, tree-shakable (auth is in the initial bundle).
import * as z from 'zod/mini';

/** Minimum password length enforced by Supabase default config. */
const MIN_PASSWORD_LENGTH = 6;

const emailSchema = z
  .string()
  .check(z.minLength(1, 'auth.validation.emailRequired'), z.email('auth.validation.emailInvalid'));

const passwordSchema = z
  .string()
  .check(z.minLength(MIN_PASSWORD_LENGTH, 'auth.validation.passwordTooShort'));

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
});
