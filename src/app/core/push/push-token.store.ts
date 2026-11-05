import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

const KEY = 'luma.push.token';

/**
 * PushTokenStore — the token this phone last linked to an account, kept on the
 * device so signing out can unlink it even when it was registered in an
 * earlier run of the app. Storage can be blocked: reads then give null.
 */
@Injectable({ providedIn: 'root' })
export class PushTokenStore {
  private readonly storage = inject(DOCUMENT).defaultView?.localStorage;

  /** The linked token, or null. */
  public get(): string | null {
    try {
      return this.storage?.getItem(KEY) ?? null;
    } catch {
      return null;
    }
  }

  /** Remembers the linked token; without storage it only lasts this run (the caller keeps it too). */
  public set(token: string): void {
    try {
      this.storage?.setItem(KEY, token);
    } catch {
      // Blocked storage: the next sign-in links the token again.
    }
  }

  /** Forgets the token. */
  public clear(): void {
    try {
      this.storage?.removeItem(KEY);
    } catch {
      // Blocked storage: nothing was kept.
    }
  }
}
