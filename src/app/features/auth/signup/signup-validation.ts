import { emailSchema, newPasswordSchema } from '@core/auth/auth.schemas';
import { Phone } from '@shared/account/phone';
import { isCommonPassword } from './common-passwords';
import { STEP_FIELDS, type SignupDraft, type SignupErrors, type SignupStep } from './signup-draft';

const V = 'auth.signup.validation';
/** Mirrors profiles.full_name (at most 80 characters). */
export const MAX_FULL_NAME = 80;

type Rule = (draft: SignupDraft) => string | null;

const RULES: Readonly<Record<keyof SignupDraft, Rule>> = {
  accountType: (d) => (d.accountType ? null : `${V}.accountType`),
  fullName: (d) => {
    const name = d.fullName.trim();
    return name.length >= 2 && name.length <= MAX_FULL_NAME ? null : `${V}.fullName`;
  },
  // Required for business owners (the review team calls them), optional for customers.
  phone: (d) => {
    if (!d.phone.trim()) return d.accountType === 'business_owner' ? `${V}.phoneRequired` : null;
    return Phone.parse(d.phone) ? null : `${V}.phone`;
  },
  email: (d) => {
    const parsed = emailSchema.safeParse(d.email);
    return parsed.success ? null : parsed.error.issues[0].message;
  },
  password: (d) => {
    if (!newPasswordSchema.safeParse(d.password).success) return 'auth.validation.passwordWeak';
    return isCommonPassword(d.password) ? `${V}.passwordCommon` : null;
  },
  acceptedTerms: (d) => (d.acceptedTerms ? null : `${V}.terms`),
  acceptedPrivacy: (d) => (d.acceptedPrivacy ? null : `${V}.privacy`),
  isAdult: (d) => (d.isAdult ? null : `${V}.adult`),
};

/** Errors of one step (empty when it can move on). */
export function validateStep(step: SignupStep, draft: SignupDraft): SignupErrors {
  const errors: SignupErrors = {};
  for (const field of STEP_FIELDS[step]) {
    const error = RULES[field](draft);
    if (error) errors[field] = error;
  }
  return errors;
}

/** Error of a single field, for live feedback after it was touched. */
export function validateField(field: keyof SignupDraft, draft: SignupDraft): string | null {
  return RULES[field](draft);
}
