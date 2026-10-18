import type { IconName } from '@design-system';
import type { AccountTypeValue } from '@shared/account/account-type';

/** One tutorial screen: texts under onboarding.{audience}.{key}.{title|body}. */
export interface OnboardingSlide {
  readonly key: string;
  readonly icon: IconName;
}

/** Four screens per account type, in order. */
export const ONBOARDING_SLIDES: Readonly<Record<AccountTypeValue, readonly OnboardingSlide[]>> = {
  customer: [
    { key: 'discover', icon: 'map' },
    { key: 'promotions', icon: 'tag' },
    { key: 'order', icon: 'receipt' },
    { key: 'favorites', icon: 'heart' },
  ],
  business_owner: [
    { key: 'verify', icon: 'store' },
    { key: 'menu', icon: 'utensils' },
    { key: 'orders', icon: 'bell' },
    { key: 'hours', icon: 'clock' },
  ],
};

/** Translation namespace of each audience. */
export const ONBOARDING_AUDIENCE: Readonly<Record<AccountTypeValue, string>> = {
  customer: 'customer',
  business_owner: 'owner',
};
