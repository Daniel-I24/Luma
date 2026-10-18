import type { AccountTypeValue } from './account-type';

/** Where each account type lands after signing in. */
export const ACCOUNT_HOMES: Readonly<Record<AccountTypeValue, string>> = {
  customer: '/map',
  business_owner: '/business',
};
