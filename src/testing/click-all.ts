import { ErrorHandler, type Provider } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';

/** Collects every error Angular reports while the helper clicks. */
export class CollectingErrorHandler implements ErrorHandler {
  readonly errors: unknown[] = [];

  handleError(error: unknown): void {
    this.errors.push(error);
  }
}

/**
 * Provide it in the TestBed (with rethrowApplicationErrors: false) so
 * clickAll can see errors thrown by event handlers.
 */
export function provideCollectingErrorHandler(): Provider[] {
  const handler = new CollectingErrorHandler();
  return [
    { provide: CollectingErrorHandler, useValue: handler },
    { provide: ErrorHandler, useValue: handler },
  ];
}

const CLICKABLE = 'button:not([disabled]), [role="button"]:not([aria-disabled="true"]), [role="switch"]:not([disabled])';

export interface ClickAllReport {
  /** Accessible names (or text) of what was clicked, in order. */
  readonly clicked: readonly string[];
  readonly errors: readonly unknown[];
}

/**
 * Clicks every enabled button, role="button" and switch of the rendered
 * component once (in document order), waiting for the component to settle
 * after each click, and reports what failed. Links are not followed: the
 * routes they point to are checked by scripts/check-interactive.mjs.
 *
 *   const report = await clickAll(fixture, TestBed.inject(CollectingErrorHandler));
 *   expect(report.errors).toEqual([]);
 */
export async function clickAll(
  fixture: ComponentFixture<unknown>,
  handler: CollectingErrorHandler,
  limit = 50,
): Promise<ClickAllReport> {
  const clicked: string[] = [];
  const seen = new Set<Element>();
  const unhandled: unknown[] = [];
  const onRejection = (event: PromiseRejectionEvent) => unhandled.push(event.reason);
  globalThis.addEventListener?.('unhandledrejection', onRejection);
  try {
    for (let i = 0; i < limit; i++) {
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      const next = Array.from(root.querySelectorAll<HTMLElement>(CLICKABLE)).find((el) => !seen.has(el));
      if (!next) break;
      seen.add(next);
      clicked.push(next.getAttribute('aria-label') ?? next.textContent?.trim() ?? next.tagName);
      try {
        next.click();
        await fixture.whenStable();
      } catch (error) {
        handler.errors.push(error);
      }
    }
  } finally {
    globalThis.removeEventListener?.('unhandledrejection', onRejection);
  }
  return { clicked, errors: [...handler.errors, ...unhandled] };
}
