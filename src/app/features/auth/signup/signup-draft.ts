import type { AccountTypeValue } from '@shared/account/account-type';

/** Steps of /auth/register, in order. */
export const SIGNUP_STEPS = ['accountType', 'personal', 'credentials', 'consent'] as const;
export type SignupStep = (typeof SIGNUP_STEPS)[number];

/** What the stepped sign-up collects. A customer gives no address (pick-up app, Ley 1581). */
export interface SignupDraft {
  accountType: AccountTypeValue | null;
  fullName: string;
  phone: string;
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
  credentials: ['email', 'password'],
  consent: ['acceptedTerms', 'acceptedPrivacy', 'isAdult'],
};
