import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { ErrorLog } from '@core/errors/error-log';
import { SignOutHooks } from '@core/auth/session-end';
import { DeviceTokenRepository } from './device-token.repository';
import { type PushAction, type PushChannel, type PushPermission, PushPlatform } from './push-platform';
import { PushRoute } from './push-route';

/** Why push is not working on this phone, each with its own message. */
export type PushProblem = 'denied' | 'not_configured' | 'registration_failed' | 'token_save_failed';

/**
 * PushRegistration — links this device to the signed-in user for push
 * notifications. Never asks for permission by itself: only enable() does,
 * from a user action (the notification settings). When permission is
 * already granted, each sign-in refreshes the token; signing out removes
 * it first. A tapped notification opens the screen PushRoute picks.
 * Nothing here throws: each failure becomes a PushProblem the settings
 * explain, and the error itself goes to ErrorLog.
 */
@Injectable({ providedIn: 'root' })
export class PushRegistration {
  private readonly platform = inject(PushPlatform);
  private readonly tokens = inject(DeviceTokenRepository);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly log = inject(ErrorLog);

  private readonly _permission = signal<PushPermission>('prompt');
  private readonly _problem = signal<PushProblem | null>(null);
  private token: string | null = null;
  public readonly permission = this._permission.asReadonly();
  /** The last failure of enable() or a sign-in refresh; null when fine. */
  public readonly problem = this._problem.asReadonly();

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
    this._permission.set(await this.currentPermission());
    try {
      await this.platform.onAction((action) => void this.open(action));
    } catch (error) {
      this.log.record(error, 'push');
    }
  }

  /** From a user action: asks for permission and registers. Resolves to the permission. */
  public async enable(): Promise<PushPermission> {
    let permission = await this.currentPermission();
    if (permission === 'prompt') {
      try {
        permission = await this.platform.requestPermission();
      } catch (error) {
        this.log.record(error, 'push');
        permission = 'denied';
      }
    }
    this._permission.set(permission);
    this._problem.set(PushRegistration.problemOf(permission));
    if (permission === 'granted') await this.refresh();
    return permission;
  }

  private async refresh(): Promise<void> {
    if (!this.auth.user() || (await this.currentPermission()) !== 'granted') return;
    let token: string;
    try {
      await this.platform.createChannels(this.channels());
      token = await this.platform.register();
    } catch (error) {
      return this.fail('registration_failed', error);
    }
    if (!(await this.tokens.register(token))) return this.fail('token_save_failed', new Error('register_device_token failed'));
    this.token = token;
    this._problem.set(null);
  }

  private async currentPermission(): Promise<PushPermission> {
    try {
      return await this.platform.permission();
    } catch (error) {
      this.log.record(error, 'push');
      return 'unavailable';
    }
  }

  private fail(problem: PushProblem, error: unknown): void {
    this.log.record(error, 'push');
    this._problem.set(problem);
  }

  private async forget(): Promise<void> {
    const token = this.token;
    this.token = null;
    if (token && !(await this.tokens.unregister(token))) this.log.record(new Error('unregister_device_token failed'), 'push');
  }

  private async open(action: PushAction): Promise<void> {
    try {
      await this.router.navigate([...PushRoute.of(action)]);
    } catch (error) {
      this.log.record(error, 'push');
    }
  }

  private static problemOf(permission: PushPermission): PushProblem | null {
    if (permission === 'denied') return 'denied';
    return permission === 'not_configured' ? 'not_configured' : null;
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
