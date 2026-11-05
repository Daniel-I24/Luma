import { Injectable, signal } from '@angular/core';

/** The steps of linking this phone, in the order they happen. */
export const PUSH_STEPS = ['permission', 'channels', 'register', 'event', 'error', 'rpc'] as const;
export type PushStep = (typeof PUSH_STEPS)[number];

/** The last result of one step. `detail` is a code or a masked token, never personal data. */
export interface PushStepResult {
  readonly ok: boolean;
  readonly detail: string;
  readonly at: string;
}

/** How much of a token "Información técnica" may show. */
const VISIBLE_TOKEN_END = 6;

/**
 * PushDiagnostics — the last result of each push step on this phone, in memory
 * only, for "Información técnica": what support needs to tell a refused
 * permission from a silent FCM or a failed RPC.
 */
@Injectable({ providedIn: 'root' })
export class PushDiagnostics {
  private readonly _steps = signal<Readonly<Partial<Record<PushStep, PushStepResult>>>>({});
  public readonly steps = this._steps.asReadonly();

  /** Keeps the result of a step, replacing the previous one. */
  public record(step: PushStep, ok: boolean, detail: string): void {
    const result: PushStepResult = { ok, detail, at: new Date().toISOString() };
    this._steps.update((steps) => ({ ...steps, [step]: result }));
  }

  /** A token as it may be shown: its length and last characters only. */
  public static mask(token: string): string {
    return `…${token.slice(-VISIBLE_TOKEN_END)} (${token.length})`;
  }
}
