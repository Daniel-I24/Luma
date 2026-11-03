import { Injectable, signal } from '@angular/core';

/**
 * PendingVerification — the email waiting for a code, kept in memory so it
 * never travels in a URL. After a reload it is gone and the code screens ask
 * for the email again.
 */
@Injectable({ providedIn: 'root' })
export class PendingVerification {
  private readonly _email = signal<string | null>(null);
  public readonly email = this._email.asReadonly();

  /** Remembers the e-mail waiting for its confirmation code. */
  public set(email: string): void {
    this._email.set(email.trim());
  }

  /** Forgets the pending e-mail. */
  public clear(): void {
    this._email.set(null);
  }
}
