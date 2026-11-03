import { DestroyRef, type Signal, inject, signal } from '@angular/core';
import { MS_PER_SECOND } from '@core/config/units';

/** A running countdown: seconds left and a way to (re)start it. */
export interface CountdownHandle {
  readonly remaining: Signal<number>;
  start(seconds: number): void;
}

/** Countdown — a signal that counts down to a date. */
export class Countdown {
  /**
   * Countdown in whole seconds (e.g. "Reenviar código en 60 s"). Stops by
   * itself at 0 and when the caller is destroyed. Injection context only.
   */
  public static createCountdown(): CountdownHandle {
    const remaining = signal(0);
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = (): void => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    inject(DestroyRef).onDestroy(stop);
    return {
      remaining: remaining.asReadonly(),
      start(seconds: number): void {
        stop();
        remaining.set(seconds);
        timer = setInterval(() => {
          remaining.update((value) => value - 1);
          if (remaining() <= 0) stop();
        }, MS_PER_SECOND);
      },
    };
  }
}

