import { DOCUMENT, Injectable, Injector, inject } from '@angular/core';
import { AppReadiness } from './app-readiness';
import { EntryPolicy } from './entry-policy';

const ENTRY_ID = 'luma-entry';
const PLAY_CLASS = 'app-entry--play';
const LEAVE_CLASS = 'app-entry--leave';
const LEAVE_TOKEN = '--duration-normal';

/**
 * AppEntry — runs the entry painted by index.html (the native splash
 * continued, styles/entry.css): plays it while the app gets ready and fades
 * it out to the first screen. It lasts at most EntryPolicy's cap, ends as
 * soon as AppReadiness resolves (it never holds a ready app), and a tap
 * skips it. Only on a cold start: the element exists once per page load.
 */
@Injectable({ providedIn: 'root' })
export class AppEntry {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private element: HTMLElement | null = null;

  public start(): void {
    const element = this.document.getElementById(ENTRY_ID);
    if (!element || this.element) return;
    this.element = element;
    const maxMs = this.injector.get(EntryPolicy).maxDurationMs();
    element.style.setProperty('--entry-duration', `${maxMs}ms`);
    element.classList.add(PLAY_CLASS);
    element.addEventListener('pointerdown', () => this.finish(), { once: true });
    const cap = new Promise<void>((resolve) => setTimeout(resolve, maxMs));
    void Promise.race([this.injector.get(AppReadiness).ready, cap]).then(() => this.finish());
  }

  /** Fades the entry out once, then removes it (also when animations are off). */
  private finish(): void {
    const element = this.element;
    if (!element?.isConnected || element.classList.contains(LEAVE_CLASS)) return;
    element.classList.add(LEAVE_CLASS);
    const view = this.document.defaultView;
    const leaveMs = view ? Number.parseFloat(view.getComputedStyle(element).getPropertyValue(LEAVE_TOKEN)) : 0;
    // The mark and halo also fire animationend; only the entry's own fade counts.
    element.addEventListener('animationend', (event) => event.target === element && element.remove());
    setTimeout(() => element.remove(), Number.isFinite(leaveMs) ? leaveMs : 0);
  }
}
