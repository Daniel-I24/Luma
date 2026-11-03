import type { AccountTypeValue } from './account-type';

/** Where each account type lands after signing in. */
export const ACCOUNT_HOMES: Readonly<Record<AccountTypeValue, string>> = {
  customer: '/map',
  business_owner: '/owner',
};

/** Shown when the account type cannot be read (with "Reintentar"). */
export const ACCOUNT_ERROR_PATH = '/account-error';
