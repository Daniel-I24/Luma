import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { SignOutHooks } from '@core/auth/session-end';
import { DeviceTokenRepository } from './device-token.repository';
import { type PushAction, type PushChannel, type PushPermission, PushPlatform } from './push-platform';
import { PushRoute } from './push-route';

/**
 * PushRegistration — links this device to the signed-in user for push
 * notifications. Never asks for permission by itself: only enable() does,
 * from a user action (the notification settings). When permission is
 * already granted, each sign-in refreshes the token; signing out removes
 * it first. A tapped notification opens the screen PushRoute picks.
 */
@Injectable({ providedIn: 'root' })
export class PushRegistration {
  private readonly platform = inject(PushPlatform);
  private readonly tokens = inject(DeviceTokenRepository);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  private readonly _permission = signal<PushPermission>('prompt');
  private token: string | null = null;
  public readonly permission = this._permission.asReadonly();

  constructor() {
    inject(SignOutHooks).add(() => this.forget());
    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      untracked(() => {
        if (userId) void this.refresh();
        else this.token = null;
      });
    });
  }

  /** Called once at start-up (app initializer). */
  public async init(): Promise<void> {
    this._permission.set(await this.platform.permission());
    await this.platform.onAction((action) => void this.open(action));
  }

  /** From a user action: asks for permission and registers. Resolves to the permission. */
  public async enable(): Promise<PushPermission> {
    let permission = await this.platform.permission();
    if (permission === 'prompt') permission = await this.platform.requestPermission();
    this._permission.set(permission);
    if (permission === 'granted') await this.refresh();
    return permission;
  }

  private async refresh(): Promise<void> {
    if (!this.auth.user() || (await this.platform.permission()) !== 'granted') return;
    try {
      await this.platform.createChannels(this.channels());
      const token = await this.platform.register();
      if (await this.tokens.register(token)) this.token = token;
    } catch {
      // Best effort: the in-app notifications keep working.
    }
  }

  private async forget(): Promise<void> {
    const token = this.token;
    this.token = null;
    if (token) await this.tokens.unregister(token);
  }

  private open(action: PushAction): Promise<boolean> {
    return this.router.navigate([...PushRoute.of(action)]);
  }

  /** Channel names are shown in Android settings, so they are translated. */
  private channels(): PushChannel[] {
    const t = (key: string): string => this.transloco.translate(key);
    return [
      { id: 'orders', name: t('push.channels.orders.name'), description: t('push.channels.orders.description'), importance: 4 },
      {
        id: 'promotions', name: t('push.channels.promotions.name'),
        description: t('push.channels.promotions.description'), importance: 3,
      },
    ];
  }
}
