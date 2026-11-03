import { Injectable, inject } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '@shared/business/data/business.repository';

/** What each user receives (profiles.notify_orders / notify_promotions). */
export interface NotificationPreferences {
  /** Orders and reviews of the user's businesses. On by default. */
  readonly orders: boolean;
  /** Promotions of saved businesses. Off until the user opts in. */
  readonly promotions: boolean;
}

interface PreferencesRow {
  notify_orders: boolean;
  notify_promotions: boolean;
}

/** NotificationPreferencesRepository — the signed-in user's own preferences (RLS: own row). */
@Injectable({ providedIn: 'root' })
export class NotificationPreferencesRepository {
  private readonly db = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  /** The user's notification preferences. */
  public async get(): Promise<RepoResult<NotificationPreferences>> {
    const userId = this.auth.user()?.id;
    if (!userId) return { data: null, errorKey: 'notificationSettings.errors.load' };
    const { data, error } = await this.db
      .from('profiles')
      .select('notify_orders, notify_promotions')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return { data: null, errorKey: 'notificationSettings.errors.load' };
    const row = data as PreferencesRow;
    return { data: { orders: row.notify_orders, promotions: row.notify_promotions }, errorKey: null };
  }

  /** Saves the user's notification preferences. */
  public async set(preferences: NotificationPreferences): Promise<RepoResult<true>> {
    const userId = this.auth.user()?.id;
    if (!userId) return { data: null, errorKey: 'notificationSettings.errors.save' };
    const { error } = await this.db
      .from('profiles')
      .update({ notify_orders: preferences.orders, notify_promotions: preferences.promotions })
      .eq('id', userId);
    if (error) return { data: null, errorKey: 'notificationSettings.errors.save' };
    return { data: true, errorKey: null };
  }

  /** send_test_notification: a test notice to this user (3 a day); push-dispatch pushes it to the phone. */
  public async sendTest(): Promise<RepoResult<true>> {
    const { error } = await this.db.rpc('send_test_notification');
    if (error) {
      const limited = error.message?.includes('rate_limited');
      return { data: null, errorKey: limited ? 'notificationSettings.test.limited' : 'notificationSettings.test.failed' };
    }
    return { data: true, errorKey: null };
  }
}
