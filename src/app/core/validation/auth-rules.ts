import { CODE_LENGTH } from '@core/auth/auth.schemas';
import { FieldRules } from './field-rule';
import { PASSWORD_MAX } from './password-policy';
import { Spec } from './specification';

/** AuthRules — one-time codes and the current password (new passwords: PasswordRules). */
export const AuthRules = {
  /** The 6 digits Supabase emails or texts; spaces and dashes of a pasted code are dropped. */
  code: FieldRules.define({
    messageKey: 'auth.validation.codeInvalid',
    maxLength: CODE_LENGTH,
    normalize: (raw) => raw.replace(/\D/g, ''),
    spec: Spec.matches(new RegExp(`^\\d{${CODE_LENGTH}}$`)),
  }),
  /** The current password: only required. */
  currentPassword: FieldRules.define({ messageKey: 'auth.validation.passwordRequired', maxLength: PASSWORD_MAX, normalize: (raw) => raw, spec: Spec.length(1, PASSWORD_MAX) }),
} as const;
