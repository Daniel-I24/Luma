import type { AccountTypeValue } from '@shared/account/account-type';
import type { Residence } from '@shared/geo/residence';

/** Steps of /auth/register, in order. */
export const SIGNUP_STEPS = ['accountType', 'personal', 'residence', 'photo', 'credentials', 'consent'] as const;
export type SignupStep = (typeof SIGNUP_STEPS)[number];

/**
 * What the stepped sign-up collects. No street address (pick-up app, Ley
 * 1581): only the municipality of residence. The photo is optional and
 * needs its own consent.
 */
export interface SignupDraft {
  accountType: AccountTypeValue | null;
  fullName: string;
  phone: string;
  residence: Residence | null;
  avatar: File | null;
  avatarConsent: boolean;
  email: string;
  password: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  isAdult: boolean;
}

export type SignupField = keyof SignupDraft;

/** Field → translation key of its error. */
export type SignupErrors = Partial<Record<SignupField, string>>;

export const EMPTY_SIGNUP_DRAFT: SignupDraft = {
  accountType: null,
  fullName: '',
  phone: '',
  residence: null,
  avatar: null,
  avatarConsent: false,
  email: '',
  password: '',
  acceptedTerms: false,
  acceptedPrivacy: false,
  isAdult: false,
};

/** Fields of each step, in form order (the first invalid one takes the focus). */
export const STEP_FIELDS: Readonly<Record<SignupStep, readonly SignupField[]>> = {
  accountType: ['accountType'],
  personal: ['fullName', 'phone'],
  residence: ['residence'],
  photo: ['avatarConsent'],
  credentials: ['email', 'password'],
  consent: ['acceptedTerms', 'acceptedPrivacy', 'isAdult'],
};
