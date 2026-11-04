/** Wompi environment: sandbox ('test') or production ('prod'). */
export type WompiEnvironment = 'test' | 'prod';

/** The keys of one Wompi merchant account. Never logged, never sent to the app. */
export interface MerchantCredentials {
  readonly environment: WompiEnvironment;
  readonly publicKey: string;
  readonly privateKey: string;
  readonly integritySecret: string;
  readonly eventsSecret: string;
}

/** Reads one secret by name (Deno.env.get in production, a map in tests). */
export type SecretReader = (name: string) => string | undefined;

/**
 * PlatformMerchantCredentials — Luma's own Wompi account collects every
 * online payment (docs/payments.md explains the path to one account per
 * restaurant). Each key must carry the prefix of its environment, so a
 * production function can never run with sandbox keys or the other way.
 */
export class PlatformMerchantCredentials implements MerchantCredentials {
  private static readonly PREFIXES: Readonly<Record<WompiEnvironment, Readonly<Record<string, string>>>> = {
    test: { publicKey: 'pub_test_', privateKey: 'prv_test_', integritySecret: 'test_integrity_', eventsSecret: 'test_events_' },
    prod: { publicKey: 'pub_prod_', privateKey: 'prv_prod_', integritySecret: 'prod_integrity_', eventsSecret: 'prod_events_' },
  };

  private constructor(
    public readonly environment: WompiEnvironment,
    public readonly publicKey: string,
    public readonly privateKey: string,
    public readonly integritySecret: string,
    public readonly eventsSecret: string,
  ) {}

  /** Null when WOMPI_ENV is missing or any key is missing or has the wrong prefix. */
  public static fromSecrets(read: SecretReader): PlatformMerchantCredentials | null {
    const environment = read('WOMPI_ENV');
    if (environment !== 'test' && environment !== 'prod') return null;
    const keys = {
      publicKey: read('WOMPI_PUBLIC_KEY'), privateKey: read('WOMPI_PRIVATE_KEY'),
      integritySecret: read('WOMPI_INTEGRITY_SECRET'), eventsSecret: read('WOMPI_EVENTS_SECRET'),
    };
    const prefixes = PlatformMerchantCredentials.PREFIXES[environment];
    for (const [name, value] of Object.entries(keys)) {
      const prefix = prefixes[name];
      // No known prefix means no valid key: reject rather than accept anything.
      if (!prefix || !value || !value.startsWith(prefix) || value.length <= prefix.length) return null;
    }
    return new PlatformMerchantCredentials(
      environment, keys.publicKey!, keys.privateKey!, keys.integritySecret!, keys.eventsSecret!,
    );
  }
}

/**
 * MerchantCredentialsFactory — picks the account that collects a payment.
 * Today always the platform account; a per-restaurant implementation would
 * be chosen here (docs/payments.md).
 */
export class MerchantCredentialsFactory {
  public constructor(private readonly read: SecretReader) {}

  public forPlatform(): MerchantCredentials | null {
    return PlatformMerchantCredentials.fromSecrets(this.read);
  }
}
