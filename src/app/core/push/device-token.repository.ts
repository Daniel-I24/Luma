import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';

/**
 * DeviceTokenRepository — the push token of this device, through the
 * register_device_token / unregister_device_token RPCs (the table is closed
 * to clients). Resolves to false on any error: push is best effort.
 */
@Injectable({ providedIn: 'root' })
export class DeviceTokenRepository {
  private readonly db = inject(SupabaseService).client;

  /** Stores this device's push token for the signed-in user. */
  public async register(token: string): Promise<boolean> {
    const { error } = await this.db.rpc('register_device_token', { p_token: token, p_platform: 'android' });
    return !error;
  }

  /** Removes this device's push token. */
  public async unregister(token: string): Promise<boolean> {
    const { error } = await this.db.rpc('unregister_device_token', { p_token: token });
    return !error;
  }
}
