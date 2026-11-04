import { emailSchema } from '@core/auth/auth.schemas';
import { ContactRules } from '@core/validation/contact-rules';
import { PasswordRules } from '@core/validation/password-rules';
import { FieldRules } from '@core/validation/field-rule';
import { PERSON_NAME_MAX, TextRules } from '@core/validation/text-rules';
import { STEP_FIELDS, type SignupDraft, type SignupErrors, type SignupStep } from './signup-draft';
import { ZodRules } from '@core/validation/zod-rules';

const V = 'auth.signup.validation';
/** profiles_full_name_rule (core/validation, at most 60). */
export const MAX_FULL_NAME = PERSON_NAME_MAX;

type Rule = (draft: SignupDraft) => string | null;

const RULES: Readonly<Record<keyof SignupDraft, Rule>> = {
  accountType: (d) => (d.accountType ? null : `${V}.accountType`),
  fullName: (d) => FieldRules.checkRequired(TextRules.personName, d.fullName),
  // Required for everyone (is_profile_complete): it verifies the account and stops fake orders.
  phone: (d) => FieldRules.checkRequired(ContactRules.mobilePhone, d.phone),
  residence: (d) => (d.residence ? null : `${V}.residence`),
  avatar: () => null,
  // The photo is optional; when there is one, its consent is required.
  avatarConsent: (d) => (!d.avatar || d.avatarConsent ? null : `${V}.avatarConsent`),
  email: (d) => {
    const parsed = emailSchema.safeParse(d.email);
    return parsed.success ? null : ZodRules.firstMessage(parsed.error);
  },
  password: (d) => PasswordRules.errorKey(d.password, d.email),
  acceptedTerms: (d) => (d.acceptedTerms ? null : `${V}.terms`),
  acceptedPrivacy: (d) => (d.acceptedPrivacy ? null : `${V}.privacy`),
  isAdult: (d) => (d.isAdult ? null : `${V}.adult`),
};

/** SignupValidation — field and step validation of the sign-up wizard. */
export class SignupValidation {
  /** Errors of one step (empty when it can move on). */
  public static validateStep(step: SignupStep, draft: SignupDraft): SignupErrors {
    const errors: SignupErrors = {};
    for (const field of STEP_FIELDS[step]) {
      const error = RULES[field](draft);
      if (error) errors[field] = error;
    }
    return errors;
  }

  /** Error of a single field, for live feedback after it was touched. */
  public static validateField(field: keyof SignupDraft, draft: SignupDraft): string | null {
    return RULES[field](draft);
  }
}

