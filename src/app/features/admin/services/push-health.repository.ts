import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';

/** admin_push_health(): the last answer of push-dispatch, and counts. */
export interface PushHealth {
  readonly status: number | null;
  /** What push-dispatch answered: counts and FCM reasons, never tokens. */
  readonly body: string | null;
  /** When it answered, and the network error if it could not (migration 63). */
  readonly at: string | null;
  readonly error: string | null;
  readonly tokens: number;
  readonly unsent: number;
  readonly retrying: number;
}

/** PushHealthRepository — lets the team see why a notice did not reach a phone. */
@Injectable({ providedIn: 'root' })
export class PushHealthRepository {
  private readonly db = inject(SupabaseService).client;

  /** Null when it cannot be read (no aal2, or migration 59 not applied). */
  public async read(): Promise<PushHealth | null> {
    const { data, error } = await this.db.rpc('admin_push_health');
    if (error || !data) return null;
    const row = data as Partial<PushHealth>;
    return {
      status: row.status ?? null, body: row.body ?? null, at: row.at ?? null, error: row.error ?? null,
      tokens: row.tokens ?? 0, unsent: row.unsent ?? 0, retrying: row.retrying ?? 0,
    };
  }
}
