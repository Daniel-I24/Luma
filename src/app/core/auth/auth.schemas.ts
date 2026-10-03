import { z } from 'zod';

/** Minimum password length enforced by Supabase default config. */
const MIN_PASSWORD_LENGTH = 6;

export const emailSchema = z
  .string()
  .min(1, 'auth.validation.emailRequired')
  .email('auth.validation.emailInvalid');

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, 'auth.validation.passwordTooShort');

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

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
