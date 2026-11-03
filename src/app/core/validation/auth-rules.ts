import { CODE_LENGTH, MIN_PASSWORD_LENGTH, PASSWORD_PATTERN } from '@core/auth/auth.schemas';
import { FieldRules } from './field-rule';
import { Spec } from './specification';

/** Supabase Auth hashes at most 72 bytes of a password. */
const PASSWORD_MAX = 72;

/** AuthRules — one-time codes and new passwords (Supabase Auth checks them again). */
export const AuthRules = {
  /** The 6 digits Supabase emails or texts; spaces and dashes of a pasted code are dropped. */
  code: FieldRules.define({
    messageKey: 'auth.validation.codeInvalid',
    maxLength: CODE_LENGTH,
    normalize: (raw) => raw.replace(/\D/g, ''),
    spec: Spec.matches(new RegExp(`^\\d{${CODE_LENGTH}}$`)),
  }),
  /** At least 8 characters with a letter and a digit; never trimmed or changed. */
  newPassword: FieldRules.define({
    messageKey: 'auth.validation.passwordWeak',
    maxLength: PASSWORD_MAX,
    normalize: (raw) => raw,
    spec: Spec.all(Spec.length(MIN_PASSWORD_LENGTH, PASSWORD_MAX), Spec.matches(PASSWORD_PATTERN)),
  }),
  /** The current password: only required. */
  currentPassword: FieldRules.define({ messageKey: 'auth.validation.passwordRequired', maxLength: PASSWORD_MAX, normalize: (raw) => raw, spec: Spec.length(1, PASSWORD_MAX) }),
} as const;
