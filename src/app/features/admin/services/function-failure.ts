const KEY = 'admin.operations.errors.';

/** What each answer of a payment function means for the person pressing the button. */
const BY_STATUS: Readonly<Record<number, string>> = {
  401: 'needsMfa',
  403: 'needsMfa',
  404: 'notDeployed',
  409: 'notVoidable',
  503: 'missingKeys',
};

/**
 * FunctionFailure — why an Edge Function call of the admin panel failed, as its
 * own message: not deployed, no second factor, no Wompi keys, or no connection.
 */
export class FunctionFailure {
  /** The translation key for what `functions.invoke` answered. */
  public static keyOf(error: unknown): string {
    const status = (error as { context?: { status?: unknown } } | null)?.context?.status;
    if (typeof status !== 'number') return `${KEY}network`;
    return `${KEY}${BY_STATUS[status] ?? 'failed'}`;
  }

  /** The same failure, when payments are switched off: that is the real reason of a 503. */
  public static withConfig(key: string, paymentsEnabled: boolean | null): string {
    return key === `${KEY}missingKeys` && paymentsEnabled === false ? `${KEY}paymentsOff` : key;
  }
}
