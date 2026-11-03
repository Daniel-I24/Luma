import { WOMPI_API_BASE } from '../config/provider-urls.ts';
import type { MerchantCredentials } from './merchant-credentials.ts';
import type { EventTransaction } from './wompi-event.ts';
import { WompiEventParser } from './wompi-event.ts';

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** The API could not answer (network, timeout, 5xx): the caller retries later. */
export class WompiUnavailable extends Error {
  public constructor() {
    super('wompi_unavailable');
  }
}

/**
 * WompiApi — adapter for the two Wompi API calls Luma makes, always with
 * the private key from the server (docs.wompi.co, "Transacciones"):
 *   GET  /v1/transactions/{id}       the confirmed state of a transaction
 *   POST /v1/transactions/{id}/void  void a card transaction
 */
export class WompiApi {
  private static readonly TIMEOUT_MS = 10_000;
  private static readonly NOT_FOUND = 404;
  private static readonly SERVER_ERROR = 500;

  public constructor(
    private readonly credentials: MerchantCredentials,
    private readonly fetchFn: FetchLike = (url, init) => fetch(url, init),
  ) {}

  /** The transaction as Wompi has it now; null when it does not exist. */
  public async transaction(id: string): Promise<EventTransaction | null> {
    const res = await this.call(`/transactions/${encodeURIComponent(id)}`, 'GET');
    if (res.status === WompiApi.NOT_FOUND) {
      await res.body?.cancel();
      return null;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw res.status >= WompiApi.SERVER_ERROR ? new WompiUnavailable() : new Error('wompi_refused');
    }
    const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
    const transaction = WompiEventParser.parseTransaction(body?.data);
    if (!transaction || transaction.id !== id) throw new WompiUnavailable();
    return transaction;
  }

  /** True when Wompi accepted the void; false when it refused it (e.g. not a card). */
  public async void(id: string): Promise<boolean> {
    const res = await this.call(`/transactions/${encodeURIComponent(id)}/void`, 'POST');
    await res.body?.cancel();
    if (res.status >= WompiApi.SERVER_ERROR) throw new WompiUnavailable();
    return res.ok;
  }

  private async call(path: string, method: 'GET' | 'POST'): Promise<Response> {
    try {
      return await this.fetchFn(`${WOMPI_API_BASE[this.credentials.environment]}${path}`, {
        method,
        headers: { authorization: `Bearer ${this.credentials.privateKey}`, accept: 'application/json' },
        signal: AbortSignal.timeout(WompiApi.TIMEOUT_MS),
      });
    } catch {
      throw new WompiUnavailable();
    }
  }
}
