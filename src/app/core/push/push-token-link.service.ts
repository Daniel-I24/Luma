import { Injectable, inject } from '@angular/core';
import { ErrorLog } from '@core/errors/error-log';
import { DeviceTokenRepository } from './device-token.repository';
import { PushDiagnostics } from './push-diagnostics';
import { PushPlatform } from './push-platform';
import { PushTokenStore } from './push-token.store';

/**
 * PushTokenLink — the link between this phone's token and the account: saved
 * in the database and remembered on the device, so it can be undone later, also
 * in another run of the app. Nothing here throws: failures reach
 * PushDiagnostics and ErrorLog with their code.
 */
@Injectable({ providedIn: 'root' })
export class PushTokenLink {
  private readonly platform = inject(PushPlatform);
  private readonly tokens = inject(DeviceTokenRepository);
  private readonly stored = inject(PushTokenStore);
  private readonly log = inject(ErrorLog);
  private readonly diagnostics = inject(PushDiagnostics);

  /** Links the token to the signed-in user; false when the database refused. */
  public async save(token: string): Promise<boolean> {
    const reason = await this.tokens.register(token);
    this.diagnostics.record('rpc', reason === null, reason ?? 'saved');
    if (reason !== null) {
      this.log.record(new Error(`register_device_token: ${reason}`), 'push');
      return false;
    }
    this.stored.set(token);
    return true;
  }

  /** FCM renewed the token while the app is open: the old one no longer works. */
  public async renewed(token: string): Promise<void> {
    const previous = this.stored.get();
    if ((await this.save(token)) && previous && previous !== token) await this.unlink(previous);
  }

  /** Before signing out: the database row goes, and FCM stops even if that request fails. */
  public async forget(): Promise<void> {
    const token = this.stored.get();
    if (token) await Promise.allSettled([this.unlink(token), this.dropOnDevice()]);
  }

  /** The session ended without signOut() (expired, other tab): FCM stops on this phone. */
  public async sessionEnded(): Promise<void> {
    if (this.stored.get()) await this.dropOnDevice();
  }

  private async unlink(token: string): Promise<void> {
    const reason = await this.tokens.unregister(token);
    this.diagnostics.record('rpc', reason === null, reason ?? 'unlinked');
    if (reason !== null) this.log.record(new Error(`unregister_device_token: ${reason}`), 'push');
  }

  private async dropOnDevice(): Promise<void> {
    this.stored.clear();
    try {
      await this.platform.unregister();
    } catch (error) {
      this.log.record(error, 'push');
    }
  }
}
