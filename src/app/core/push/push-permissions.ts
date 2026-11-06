import { Injectable, inject } from '@angular/core';
import { ErrorLog } from '@core/errors/error-log';
import { PushDiagnostics } from './push-diagnostics';
import { PushPlatform } from './push-platform';
import type { PushPermission } from './push-types';

/** The permission, and whether reading or asking for it failed (it is not the user's answer then). */
export interface PermissionResult {
  readonly permission: PushPermission;
  readonly failed: boolean;
}

/** Reading the permission takes no user action, so a silent plugin counts as failed. */
export const PERMISSION_READ_TIMEOUT_MS = 10_000;

/**
 * PushPermissions — reads and asks for the notification permission, keeping each
 * attempt in PushDiagnostics before it starts: a call that never settles still
 * shows where it stopped ("checking", "asking"). A failure stays in the step with
 * its reason, and in ErrorLog. Nothing throws.
 */
@Injectable({ providedIn: 'root' })
export class PushPermissions {
  private readonly platform = inject(PushPlatform);
  private readonly diagnostics = inject(PushDiagnostics);
  private readonly log = inject(ErrorLog);

  /** The current permission, without asking the user. */
  public read(): Promise<PermissionResult> {
    this.diagnostics.record('permission', false, 'checking');
    return this.settle(() => this.withinTimeout(this.platform.permission()), 'unavailable');
  }

  /** Shows the system dialog (the user may take their time: no timeout). */
  public ask(): Promise<PermissionResult> {
    this.diagnostics.record('permission', false, 'asking');
    return this.settle(() => this.platform.requestPermission(), 'prompt');
  }

  private async settle(work: () => Promise<PushPermission>, onFailure: PushPermission): Promise<PermissionResult> {
    try {
      const permission = await work();
      this.diagnostics.record('permission', permission === 'granted', permission);
      return { permission, failed: false };
    } catch (error) {
      this.log.record(error, 'push');
      this.diagnostics.fail('permission', error);
      return { permission: onFailure, failed: true };
    }
  }

  private withinTimeout(work: Promise<PushPermission>): Promise<PushPermission> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('push_permission_timeout')), PERMISSION_READ_TIMEOUT_MS);
    });
    return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
  }
}
