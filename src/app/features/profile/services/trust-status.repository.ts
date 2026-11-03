import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';

/** my_trust_status(): how much Luma trusts the customer's pay-at-pick-up orders. */
export interface TrustStatus {
  readonly tier: 'new' | 'trusted' | 'restricted';
  /** Orders not picked up in the last 30 days. */
  readonly strikes: number;
  /** When the restriction ends (only while restricted). */
  readonly restrictedUntil: string | null;
  readonly pickedUp: number;
  /** Pick-ups left to become trusted. */
  readonly pickedUpNeeded: number;
}

const TIERS = new Set(['new', 'trusted', 'restricted']);

/** TrustStatusRepository — the caller's own trust status (never anyone else's). */
@Injectable({ providedIn: 'root' })
export class TrustStatusRepository {
  private readonly db = inject(SupabaseService).client;

  /** Null when it cannot be read: the card is then not shown. */
  public async mine(): Promise<TrustStatus | null> {
    const { data, error } = await this.db.rpc('my_trust_status');
    const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
    if (error || !row || !TIERS.has(String(row['tier']))) return null;
    return {
      tier: row['tier'] as TrustStatus['tier'],
      strikes: Number(row['strikes']) || 0,
      restrictedUntil: typeof row['restricted_until'] === 'string' ? row['restricted_until'] : null,
      pickedUp: Number(row['picked_up']) || 0,
      pickedUpNeeded: Number(row['picked_up_needed']) || 0,
    };
  }
}
