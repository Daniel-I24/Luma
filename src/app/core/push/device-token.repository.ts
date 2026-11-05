import { Injectable, inject } from '@angular/core';
import { ErrorCode } from '@core/errors/error-code';
import { SupabaseService } from '@core/supabase/supabase.service';

/**
 * DeviceTokenRepository — the push token of this device, through the
 * register_device_token / unregister_device_token RPCs (the table is closed
 * to clients). Each call resolves to null when it worked, or to the code of
 * the failure (email_not_confirmed, PGRST202, network…): never throws.
 */
@Injectable({ providedIn: 'root' })
export class DeviceTokenRepository {
  private readonly db = inject(SupabaseService).client;

  /** Stores this device's push token for the signed-in user. */
  public register(token: string): Promise<string | null> {
    return this.call(() => this.db.rpc('register_device_token', { p_token: token, p_platform: 'android' }));
  }

  /** Removes this device's push token. */
  public unregister(token: string): Promise<string | null> {
    return this.call(() => this.db.rpc('unregister_device_token', { p_token: token }));
  }

  private async call(rpc: () => PromiseLike<{ error: unknown }>): Promise<string | null> {
    try {
      const { error } = await rpc();
      return error ? ErrorCode.of(error) : null;
    } catch (error) {
      return ErrorCode.of(error);
    }
  }
}
