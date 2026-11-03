import { Injectable, inject } from '@angular/core';
import { PUSH_ENABLED } from '@core/config/push-enabled';

export type PushPermission = 'granted' | 'denied' | 'prompt' | 'unavailable';

/** What a tapped notification carries (ids only, from push-dispatch). */
export interface PushAction {
  readonly type: string | null;
  readonly orderId: string | null;
  readonly businessId: string | null;
}

/** An Android notification channel; push-dispatch sends to 'orders' or 'promotions'. */
export interface PushChannel {
  readonly id: 'orders' | 'promotions';
  readonly name: string;
  readonly description: string;
  /** Android importance: 4 high (heads-up), 3 default. */
  readonly importance: 3 | 4;
}

/**
 * PushPlatform — the device side of push notifications. The default
 * implementation uses @capacitor/push-notifications on Android (loaded
 * lazily) and reports "unavailable" on the web, where the in-app list is
 * the only channel, and while PUSH_ENABLED is false.
 */
@Injectable({ providedIn: 'root', useFactory: () => new CapacitorPushPlatform(inject(PUSH_ENABLED)) })
export abstract class PushPlatform {
  abstract permission(): Promise<PushPermission>;
  /** Asks the user (Android 13+ shows the system dialog). */
  abstract requestPermission(): Promise<PushPermission>;
  /** Registers with FCM and resolves to the device token. */
  abstract register(): Promise<string>;
  abstract unregister(): Promise<void>;
  /** Creates (or renames) the Android channels; a no-op elsewhere. */
  abstract createChannels(channels: readonly PushChannel[]): Promise<void>;
  abstract onAction(listener: (action: PushAction) => void): Promise<void>;
}

/** Android VISIBILITY_PRIVATE: the lock screen shows that a notice arrived, not its text. */
const LOCK_SCREEN_PRIVATE = 0;

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

export class CapacitorPushPlatform extends PushPlatform {
  /** False until Firebase is configured (PUSH_ENABLED): then push is "unavailable". */
  constructor(private readonly enabled: boolean) {
    super();
  }

  private async plugin() {
    if (!this.enabled) return null;
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return null;
    return (await import('@capacitor/push-notifications')).PushNotifications;
  }

  async permission(): Promise<PushPermission> {
    const push = await this.plugin();
    if (!push) return 'unavailable';
    const { receive } = await push.checkPermissions();
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt';
  }

  async requestPermission(): Promise<PushPermission> {
    const push = await this.plugin();
    if (!push) return 'unavailable';
    const { receive } = await push.requestPermissions();
    return receive === 'granted' ? 'granted' : 'denied';
  }

  async register(): Promise<string> {
    const push = await this.plugin();
    if (!push) throw new Error('push_unavailable');
    const token = new Promise<string>((resolve, reject) => {
      void push.addListener('registration', ({ value }) => resolve(value));
      void push.addListener('registrationError', () => reject(new Error('push_registration_failed')));
    });
    await push.register();
    try {
      return await token;
    } finally {
      await push.removeAllListeners();
      await this.listenActions();
    }
  }

  async unregister(): Promise<void> {
    const push = await this.plugin();
    if (push) await push.unregister();
  }

  async createChannels(channels: readonly PushChannel[]): Promise<void> {
    const push = await this.plugin();
    if (!push) return;
    for (const channel of channels) await push.createChannel({ ...channel, visibility: LOCK_SCREEN_PRIVATE });
  }

  private actionListener: ((action: PushAction) => void) | null = null;

  async onAction(listener: (action: PushAction) => void): Promise<void> {
    this.actionListener = listener;
    await this.listenActions();
  }

  private async listenActions(): Promise<void> {
    const push = await this.plugin();
    const listener = this.actionListener;
    if (!push || !listener) return;
    await push.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const data = (notification.data ?? {}) as Record<string, unknown>;
      listener({ type: text(data['type']), orderId: text(data['order_id']), businessId: text(data['business_id']) });
    });
  }
}
