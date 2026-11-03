import type { WompiEnvironment } from './merchant-credentials.ts';
import { PaymentApplier } from './payment-applier.ts';
import type { ApplyOutcome, PaymentRepository } from './payment-repository.ts';
import type { EventTransaction, WompiEvent } from './wompi-event.ts';
import { EventChecksum, WompiEventParser } from './wompi-event.ts';

/** Reject: answer the generic rejection (Wompi retries). Done: processed, answer 200. */
export type VerifyResult =
  | { readonly kind: 'reject'; readonly step: string }
  | { readonly kind: 'done'; readonly outcome: ApplyOutcome | 'not_a_transaction' };

/** What the steps learn as the event moves down the chain. */
export interface VerifyContext {
  readonly body: unknown;
  event?: WompiEvent;
  confirmed?: EventTransaction;
}

/** Confirms a transaction with the Wompi API (WompiApi.transaction). */
export interface TransactionSource {
  transaction(id: string): Promise<EventTransaction | null>;
}

/** One link of the chain: handles the context or passes it on. */
export abstract class VerificationStep {
  private next: VerificationStep | null = null;

  public then(step: VerificationStep): VerificationStep {
    this.next = step;
    return step;
  }

  public async handle(context: VerifyContext): Promise<VerifyResult> {
    const result = await this.process(context);
    if (result !== 'continue') return result;
    if (!this.next) throw new Error('chain_without_end');
    return await this.next.handle(context);
  }

  protected abstract process(context: VerifyContext): Promise<VerifyResult | 'continue'>;
}

const reject = (step: string): VerifyResult => ({ kind: 'reject', step });

/** 1. Shape, and the environment this function serves. */
export class SchemaStep extends VerificationStep {
  public constructor(private readonly environment: WompiEnvironment) {
    super();
  }

  protected process(context: VerifyContext): Promise<VerifyResult | 'continue'> {
    const event = WompiEventParser.parse(context.body);
    if (!event || event.environment !== this.environment) return Promise.resolve(reject('schema'));
    context.event = event;
    return Promise.resolve('continue');
  }
}

/** 2. Checksum with the events secret; only transaction.updated goes further. */
export class ChecksumStep extends VerificationStep {
  public constructor(private readonly eventsSecret: string) {
    super();
  }

  protected async process(context: VerifyContext): Promise<VerifyResult | 'continue'> {
    if (!(await EventChecksum.verify(context.event!, this.eventsSecret))) return reject('checksum');
    return context.event!.event === 'transaction.updated' ? 'continue' : { kind: 'done', outcome: 'not_a_transaction' };
  }
}

/** 3. The same transaction and status already processed: nothing to do. */
export class IdempotencyStep extends VerificationStep {
  public constructor(private readonly repository: PaymentRepository) {
    super();
  }

  protected async process(context: VerifyContext): Promise<VerifyResult | 'continue'> {
    const tx = context.event!.transaction!;
    return (await this.repository.eventSeen(tx.id, tx.status)) ? { kind: 'done', outcome: 'duplicate' } : 'continue';
  }
}

/** 4. Ask Wompi: the API's answer, not the event, is what gets applied. */
export class ApiConfirmationStep extends VerificationStep {
  public constructor(private readonly api: TransactionSource) {
    super();
  }

  protected async process(context: VerifyContext): Promise<VerifyResult | 'continue'> {
    const claimed = context.event!.transaction!;
    const confirmed = await this.api.transaction(claimed.id);
    if (!confirmed || confirmed.reference !== claimed.reference) return reject('api');
    context.confirmed = confirmed;
    return 'continue';
  }
}

/** 5. Amount, COP and environment must match the attempt; then the database decides. */
export class MatchAndApplyStep extends VerificationStep {
  public constructor(private readonly applier: PaymentApplier) {
    super();
  }

  protected async process(context: VerifyContext): Promise<VerifyResult | 'continue'> {
    return { kind: 'done', outcome: await this.applier.apply(context.confirmed!, 'webhook') };
  }
}

/** The full chain for one environment: schema, checksum, idempotency, API, match. */
export class PaymentEventVerifier {
  private readonly first: VerificationStep;

  public constructor(deps: {
    readonly environment: WompiEnvironment; readonly eventsSecret: string;
    readonly repository: PaymentRepository; readonly api: TransactionSource;
  }) {
    this.first = new SchemaStep(deps.environment);
    this.first.then(new ChecksumStep(deps.eventsSecret))
      .then(new IdempotencyStep(deps.repository))
      .then(new ApiConfirmationStep(deps.api))
      .then(new MatchAndApplyStep(new PaymentApplier(deps.repository, deps.environment)));
  }

  public async verify(body: unknown): Promise<VerifyResult> {
    return await this.first.handle({ body });
  }
}
