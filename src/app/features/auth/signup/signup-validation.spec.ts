import { describe, expect, it } from 'vitest';
import { isCommonPassword } from './common-passwords';
import { passwordStrength } from './password-strength';
import { EMPTY_SIGNUP_DRAFT, type SignupDraft } from './signup-draft';
import { validateStep } from './signup-validation';

const draft = (patch: Partial<SignupDraft>): SignupDraft => ({ ...EMPTY_SIGNUP_DRAFT, ...patch });

describe('validateStep', () => {
  it('asks for an account type first', () => {
    expect(validateStep('accountType', draft({}))).toEqual({
      accountType: 'auth.signup.validation.accountType',
    });
    expect(validateStep('accountType', draft({ accountType: 'customer' }))).toEqual({});
  });

  it('makes the mobile optional for customers and required for business owners', () => {
    expect(
      validateStep('personal', draft({ accountType: 'customer', fullName: 'Ana Pérez' })),
    ).toEqual({});
    expect(
      validateStep('personal', draft({ accountType: 'business_owner', fullName: 'Ana Pérez' })),
    ).toEqual({ phone: 'auth.signup.validation.phoneRequired' });
  });

  it('accepts only Colombian mobiles and names of 2 to 80 characters', () => {
    expect(
      validateStep(
        'personal',
        draft({ accountType: 'customer', fullName: ' A ', phone: '601 234 5678' }),
      ),
    ).toEqual({
      fullName: 'auth.signup.validation.fullName',
      phone: 'auth.signup.validation.phone',
    });
    expect(
      validateStep(
        'personal',
        draft({ accountType: 'business_owner', fullName: 'Ana', phone: '+57 300 123 4567' }),
      ),
    ).toEqual({});
    expect(validateStep('personal', draft({ fullName: 'a'.repeat(81) })).fullName).toBeDefined();
  });

  it('checks the email, the password rule and the common-password list', () => {
    expect(validateStep('credentials', draft({ email: 'no', password: 'abcdefgh' }))).toEqual({
      email: 'auth.validation.emailInvalid',
      password: 'auth.validation.passwordWeak',
    });
    expect(
      validateStep('credentials', draft({ email: 'a@b.co', password: 'Password123' })),
    ).toEqual({
      password: 'auth.signup.validation.passwordCommon',
    });
    expect(
      validateStep('credentials', draft({ email: 'a@b.co', password: 'tamal-pastuso-7' })),
    ).toEqual({});
  });

  it('requires the terms, the privacy policy and legal age, each with its own message', () => {
    expect(validateStep('consent', draft({ acceptedTerms: true }))).toEqual({
      acceptedPrivacy: 'auth.signup.validation.privacy',
      isAdult: 'auth.signup.validation.adult',
    });
    expect(
      validateStep('consent', draft({ acceptedTerms: true, acceptedPrivacy: true, isAdult: true })),
    ).toEqual({});
  });
});

describe('passwordStrength', () => {
  it('rates by rule, length and variety', () => {
    expect(passwordStrength('')).toBe('empty');
    expect(passwordStrength('abc12')).toBe('weak');
    expect(passwordStrength('luma1234')).toBe('weak');
    expect(passwordStrength('tamal2024')).toBe('fair');
    expect(passwordStrength('Tamal-Pastuso-2024')).toBe('strong');
  });

  it('blocks common passwords regardless of case and spaces', () => {
    expect(isCommonPassword(' PASSWORD123 ')).toBe(true);
    expect(isCommonPassword('tamal2024')).toBe(false);
  });
});
