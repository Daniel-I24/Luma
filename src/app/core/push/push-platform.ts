import { Injectable, inject } from '@angular/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { ErrorCode } from '@core/errors/error-code';
import { PushDiagnostics } from './push-diagnostics';
import { type LoadedPush, PUSH_ENABLED, type PushAction, type PushChannel, type PushPermission, type PushPlugin } from './push-types';

/** FCM answers in seconds; without an answer the registration counts as failed. */
const REGISTER_TIMEOUT_MS = 20_000;

/** Android VISIBILITY_PRIVATE: the lock screen hides the text of a notice. */
const LOCK_SCREEN_PRIVATE = 0;

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/**
 * PushPlatform — the device side of push: the plugin on Android (loaded lazily),
 * "unavailable" on the web and while PUSH_ENABLED is false.
 *
 * The registration listeners stay on after register(), so a token FCM renews
 * while the app is open still arrives (onTokenRenewed); unregister() removes
 * only those. The tap listener is added once and is never removed.
 */
@Injectable({ providedIn: 'root' })
export class PushPlatform {
  private readonly enabled = inject(PUSH_ENABLED);
  private readonly diagnostics = inject(PushDiagnostics);

  private registrationListeners: Promise<PluginListenerHandle[]> | null = null;
  private pending: { resolve(token: string): void; reject(error: Error): void } | null = null;
  private renewalListener: ((token: string) => void) | null = null;
  private tapListening = false;

  /** The plugin, or null without Firebase or outside the phone. */
  protected async plugin(): Promise<LoadedPush | null> {
    if (!this.enabled || !(await this.native())) return null;
    const { PushNotifications } = await import('@capacitor/push-notifications');
    return { push: PushNotifications };
  }

  /** Whether this is the Android app with the plugin installed. */
  protected async native(): Promise<boolean> {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('PushNotifications');
  }

  /** Current notification permission. */
  public async permission(): Promise<PushPermission> {
    const push = (await this.plugin())?.push;
    if (!push) return !this.enabled && (await this.native()) ? 'not_configured' : 'unavailable';
    const { receive } = await push.checkPermissions();
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt';
  }

  /** Asks the user (Android 13+ shows the system dialog). */
  public async requestPermission(): Promise<PushPermission> {
    const push = (await this.plugin())?.push;
    if (!push) return 'unavailable';
    const { receive } = await push.requestPermissions();
    return receive === 'granted' ? 'granted' : 'denied';
  }

  /** Registers with FCM and resolves to the device token; every failure rejects once, here. */
  public async register(): Promise<string> {
    const push = (await this.plugin())?.push;
    if (!push) throw new Error('push_unavailable');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await this.listenRegistration(push);
      const token = new Promise<string>((resolve, reject) => {
        this.pending = { resolve, reject };
        timer = setTimeout(() => reject(new Error('push_registration_timeout')), REGISTER_TIMEOUT_MS);
      });
      const accepted = push.register().then(() => this.diagnostics.record('register', true, 'accepted'));
      // Awaited together, so neither can reject unobserved.
      const [value] = await Promise.all([token, accepted]);
      return value;
    } catch (error) {
      this.diagnostics.fail('error', error);
      throw error;
    } finally {
      clearTimeout(timer);
      this.pending = null;
    }
  }

  /** Calls `listener` with a token FCM renewed outside of register(). */
  public onTokenRenewed(listener: (token: string) => void): void {
    this.renewalListener = listener;
  }

  /** Stops receiving pushes on this device (FCM deletes the token) and removes its own listeners. */
  public async unregister(): Promise<void> {
    const push = (await this.plugin())?.push;
    if (!push) return;
    const listeners = this.registrationListeners;
    this.registrationListeners = null;
    await Promise.all((await listeners)?.map((handle) => handle.remove()) ?? []);
    await push.unregister();
  }

  /** Creates (or renames) the Android channels; a no-op elsewhere. */
  public async createChannels(channels: readonly PushChannel[]): Promise<void> {
    const push = (await this.plugin())?.push;
    if (!push) return;
    for (const channel of channels) await push.createChannel({ ...channel, visibility: LOCK_SCREEN_PRIVATE, vibration: true });
  }

  /** Calls `listener` when the user taps a notification (added once for the whole run). */
  public async onAction(listener: (action: PushAction) => void): Promise<void> {
    const push = (await this.plugin())?.push;
    if (!push || this.tapListening) return;
    this.tapListening = true;
    await push.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const data = (notification.data ?? {}) as Record<string, unknown>;
      listener({ type: text(data['type']), orderId: text(data['order_id']), businessId: text(data['business_id']) });
    });
  }

  /** Both listeners are in place before register() runs; a failure can be tried again. */
  private listenRegistration(push: PushPlugin): Promise<PluginListenerHandle[]> {
    this.registrationListeners ??= Promise.all([
      push.addListener('registration', ({ value }) => this.tokenArrived(value)),
      push.addListener('registrationError', ({ error }) => this.registrationFailed(error)),
    ]).catch((error: unknown) => {
      this.registrationListeners = null;
      throw error;
    });
    return this.registrationListeners;
  }

  private tokenArrived(token: string): void {
    this.diagnostics.record('event', true, PushDiagnostics.mask(token));
    if (this.pending) this.pending.resolve(token);
    else this.renewalListener?.(token);
  }

  /** FCM refused: the rejection carries its code (SERVICE_NOT_AVAILABLE…) to the catch of register(). */
  private registrationFailed(message: string): void {
    const code = ErrorCode.of({ message });
    const reason = code === 'unknown' ? 'push_registration_failed' : code;
    if (this.pending) this.pending.reject(new Error(reason));
    else this.diagnostics.record('error', false, reason);
  }
}
