import { Injectable, signal } from '@angular/core';

/**
 * PendingVerification — the email waiting for a code, kept in memory so it
 * never travels in a URL. After a reload it is gone and the code screens ask
 * for the email again.
 */
@Injectable({ providedIn: 'root' })
export class PendingVerification {
  private readonly _email = signal<string | null>(null);
  readonly email = this._email.asReadonly();

  set(email: string): void {
    this._email.set(email.trim());
  }

  clear(): void {
    this._email.set(null);
  }
}
