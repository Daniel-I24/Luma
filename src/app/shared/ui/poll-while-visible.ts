import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject } from '@angular/core';

/**
 * Calls `refresh` every `intervalMs` while the page is visible: the timer
 * stops when the tab/app goes to the background and resumes (refreshing at
 * once) when it comes back. Stops for good when the caller is destroyed.
 * Must run in an injection context (e.g. a component constructor).
 */
export function pollWhileVisible(refresh: () => void, intervalMs: number): void {
  const document = inject(DOCUMENT);
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
  };
  const start = () => {
    stop();
    timer = setInterval(refresh, intervalMs);
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      refresh();
      start();
    } else {
      stop();
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  if (document.visibilityState === 'visible') start();
  inject(DestroyRef).onDestroy(() => {
    stop();
    document.removeEventListener('visibilitychange', onVisibilityChange);
  });
}
