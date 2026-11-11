import { signal } from '@angular/core';
import type { ContactKind } from '@shared/business/verification/contact-verification';

/** "Verificar con WhatsApp": the state is read every 3 s for 2 minutes at most. */
export const WATCH_EVERY_MS = 3_000;
export const WATCH_FOR_MS = 120_000;

/**
 * ContactWatch — after the owner opens WhatsApp, reads the state until the
 * contact is verified or 2 minutes pass; then says it timed out, so the
 * owner knows the request waits for the team.
 */
export class ContactWatch {
  private readonly _watching = signal<ContactKind | null>(null);
  private readonly _timedOut = signal<ContactKind | null>(null);
  public readonly watching = this._watching.asReadonly();
  public readonly timedOut = this._timedOut.asReadonly();
  private timer: ReturnType<typeof setInterval> | null = null;

  /** @param verified reads the state again and tells whether the contact is verified now. */
  public start(kind: ContactKind, verified: () => Promise<boolean>): void {
    this.stop();
    this._timedOut.set(null);
    this._watching.set(kind);
    const until = Date.now() + WATCH_FOR_MS;
    this.timer = setInterval(() => {
      void verified().then((done) => {
        if (!done && Date.now() < until) return;
        this.stop();
        if (!done) this._timedOut.set(kind);
      });
    }, WATCH_EVERY_MS);
  }

  /** Stops reading; what timed out stays said. */
  public stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this._watching.set(null);
  }
}
