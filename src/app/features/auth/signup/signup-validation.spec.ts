import { describe, expect, it } from 'vitest';
import { PASSWORD_VECTORS } from '../../../../testing/password-vectors';
import { EMPTY_SIGNUP_DRAFT, type SignupDraft } from './signup-draft';
import { SignupValidation } from './signup-validation';

const draft = (patch: Partial<SignupDraft>): SignupDraft => ({ ...EMPTY_SIGNUP_DRAFT, ...patch });

describe('validateStep', () => {
  it('asks for an account type first', () => {
    expect(SignupValidation.validateStep('accountType', draft({}))).toEqual({
      accountType: 'auth.signup.validation.accountType',
    });
    expect(SignupValidation.validateStep('accountType', draft({ accountType: 'customer' }))).toEqual({});
  });

  it('requires the mobile of every account (it verifies the account and stops fake orders)', () => {
    expect(
      SignupValidation.validateStep('personal', draft({ accountType: 'customer', fullName: 'Ana Pérez' })),
    ).toEqual({ phone: 'validation.required' });
    expect(
      SignupValidation.validateStep('personal', draft({ accountType: 'business_owner', fullName: 'Ana Pérez' })),
    ).toEqual({ phone: 'validation.required' });
  });

  it('accepts only Colombian mobiles and person names (letters, 2 to 60)', () => {
    expect(
      SignupValidation.validateStep(
        'personal',
        draft({ accountType: 'customer', fullName: ' A ', phone: '601 234 5678' }),
      ),
    ).toEqual({
      fullName: 'validation.personName',
      phone: 'validation.mobilePhone',
    });
    expect(
      SignupValidation.validateStep(
        'personal',
        draft({ accountType: 'business_owner', fullName: 'Ana', phone: '+57 300 123 4567' }),
      ),
    ).toEqual({});
    expect(SignupValidation.validateStep('personal', draft({ fullName: 'a'.repeat(61) })).fullName).toBeDefined();
    expect(SignupValidation.validateStep('personal', draft({ fullName: 'Ana 3' })).fullName).toBe('validation.personName');
  });

  it('checks the email, the password rule and the common-password list', () => {
    expect(SignupValidation.validateStep('credentials', draft({ email: 'no', password: 'abcdefgh' }))).toEqual({
      email: 'auth.validation.emailInvalid',
      password: 'auth.validation.passwordWeak',
    });
    expect(
      SignupValidation.validateStep('credentials', draft({ email: 'a@b.co', password: 'Password123' })),
    ).toEqual({
      password: 'auth.password.refusal.common',
    });
    expect(
      SignupValidation.validateStep('credentials', draft({ email: 'a@b.co', password: 'Tamal-pastuso-7' })),
    ).toEqual({});
  });

  it('requires the terms, the privacy policy and legal age, each with its own message', () => {
    expect(SignupValidation.validateStep('consent', draft({ acceptedTerms: true }))).toEqual({
      acceptedPrivacy: 'auth.signup.validation.privacy',
      isAdult: 'auth.signup.validation.adult',
    });
    expect(
      SignupValidation.validateStep('consent', draft({ acceptedTerms: true, acceptedPrivacy: true, isAdult: true })),
    ).toEqual({});
  });
});

describe('sign-up password (shared vectors)', () => {
  it('uses PasswordRules with the e-mail being typed', () => {
    for (const [password, key] of PASSWORD_VECTORS.invalid) {
      expect(SignupValidation.validateField('password', draft({ email: PASSWORD_VECTORS.email, password }))).toBe(key);
    }
  });
});
