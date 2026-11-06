import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { SignOutHooks } from '@core/auth/session-end';
import { ErrorLog } from '@core/errors/error-log';
import { PushDiagnostics } from './push-diagnostics';
import { type PermissionResult, PushPermissions } from './push-permissions';
import { PushPlatform } from './push-platform';
import { PushRoute } from './push-route';
import { PushTokenLink } from './push-token-link.service';
import { ANDROID_IMPORTANCE, type PushAction, type PushChannel, type PushPermission } from './push-types';

/** Why push is not working on this phone, each with its own message. */
export type PushProblem = 'denied' | 'not_configured' | 'permission_failed' | 'registration_failed' | 'token_save_failed';
const PROBLEM_OF: Partial<Record<PushPermission, PushProblem>> = { denied: 'denied', not_configured: 'not_configured' };

/**
 * PushRegistration — links this device to the signed-in user. Only enable(), from
 * a user action, asks for permission. With permission, each sign-in or start with a
 * session links the token; signing out unlinks it (PushTokenLink). Nothing throws.
 */
@Injectable({ providedIn: 'root' })
export class PushRegistration {
  private readonly platform = inject(PushPlatform);
  private readonly permissions = inject(PushPermissions);
  private readonly link = inject(PushTokenLink);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly log = inject(ErrorLog);
  private readonly diagnostics = inject(PushDiagnostics);

  private readonly _permission = signal<PushPermission>('prompt');
  private readonly _problem = signal<PushProblem | null>(null);
  private refreshing: Promise<void> | null = null;
  private previousUser: string | null = null;
  public readonly permission = this._permission.asReadonly();
  /** The last failure of enable() or a sign-in refresh; null when fine. */
  public readonly problem = this._problem.asReadonly();

  constructor() {
    inject(SignOutHooks).add(() => this.link.forget());
    this.platform.onTokenRenewed((token) => {
      if (this.auth.user()) void this.link.renewed(token);
    });
    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      untracked(() => this.userChanged(userId));
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
    this._problem.set(null);
    let permission = await this.currentPermission();
    if (permission === 'prompt') permission = this.noted(await this.permissions.ask());
    this._permission.set(permission);
    const refused = PROBLEM_OF[permission];
    if (refused) this._problem.set(refused);
    if (permission === 'granted') await this.refresh();
    return permission;
  }

  private userChanged(userId: string | null): void {
    if (!userId && this.previousUser) void this.link.sessionEnded();
    this.previousUser = userId;
    if (userId) void this.refresh();
  }

  /** One at a time: a sign-in and enable() can arrive together. */
  private refresh(): Promise<void> {
    this.refreshing ??= this.linkDevice().finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  private async linkDevice(): Promise<void> {
    if (!this.auth.user()) return;
    const permission = await this.currentPermission();
    this._permission.set(permission);
    if (permission !== 'granted') return;
    let token: string;
    try {
      await this.channelsReady();
      token = await this.platform.register();
    } catch (error) {
      this.log.record(error, 'push');
      return this._problem.set('registration_failed');
    }
    this._problem.set((await this.link.save(token)) ? null : 'token_save_failed');
  }

  private async channelsReady(): Promise<void> {
    try {
      await this.platform.createChannels(this.channels());
      this.diagnostics.record('channels', true, 'orders,promotions');
    } catch (error) {
      this.diagnostics.fail('channels', error);
      throw error;
    }
  }

  private async currentPermission(): Promise<PushPermission> {
    return this.noted(await this.permissions.read());
  }

  /** A failure is not the user's answer: it has its own message, with "Intentar de nuevo". */
  private noted({ permission, failed }: PermissionResult): PushPermission {
    if (failed) this._problem.set('permission_failed');
    return permission;
  }

  private async open(action: PushAction): Promise<void> {
    try {
      await this.router.navigate([...PushRoute.of(action)]);
    } catch (error) {
      this.log.record(error, 'push');
    }
  }

  /** Channel names are shown in Android settings, so they are translated. */
  private channels(): PushChannel[] {
    const channel = (id: PushChannel['id'], importance: PushChannel['importance']): PushChannel => ({
      id,
      importance,
      name: this.transloco.translate(`push.channels.${id}.name`),
      description: this.transloco.translate(`push.channels.${id}.description`),
    });
    return [channel('orders', ANDROID_IMPORTANCE.high), channel('promotions', ANDROID_IMPORTANCE.normal)];
  }
}
