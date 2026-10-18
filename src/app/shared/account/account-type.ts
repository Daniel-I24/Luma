/** Account types (mirrors profiles_account_type_valid). */
export const ACCOUNT_TYPES = ['customer', 'business_owner'] as const;
export type AccountTypeValue = (typeof ACCOUNT_TYPES)[number];

/** AccountType — what kind of user this is; unknown values are customers. */
export class AccountType {
  private constructor(readonly value: AccountTypeValue) {}

  static readonly customer = new AccountType('customer');
  static readonly businessOwner = new AccountType('business_owner');

  /** Never fails: anything that is not a known type is a customer. */
  static parse(value: unknown): AccountType {
    return value === 'business_owner' ? AccountType.businessOwner : AccountType.customer;
  }

  get isBusinessOwner(): boolean {
    return this.value === 'business_owner';
  }

  equals(other: AccountType): boolean {
    return this.value === other.value;
  }
}
