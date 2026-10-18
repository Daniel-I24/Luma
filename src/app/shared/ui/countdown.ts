import { DestroyRef, inject, signal } from '@angular/core';

/**
 * Countdown in whole seconds (e.g. "Reenviar código en 60 s"). Stops by
 * itself at 0 and when the caller is destroyed. Injection context only.
 */
export function createCountdown() {
  const remaining = signal(0);
  let timer: ReturnType<typeof setInterval> | null = null;
  const stop = () => {
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
      }, 1000);
    },
  };
}
