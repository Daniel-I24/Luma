import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input, output } from '@angular/core';
import { HALF } from '@core/config/units';

/**
 * appNearViewport — emits `nearViewport` when the element comes within
 * `margin` of the scroll container (IntersectionObserver), e.g. to load the
 * next page before the user reaches the end of a list.
 */
@Directive({ selector: '[appNearViewport]', standalone: true })
export class NearViewportDirective {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Scroll container to measure against (null: the viewport). */
  public readonly root = input<HTMLElement | null>(null);
  /** How far ahead to trigger, as a CSS margin (default: one screen). */
  public readonly margin = input('100% 0px');
  public readonly nearViewport = output<void>();

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) this.nearViewport.emit();
        },
        { root: this.root(), rootMargin: this.margin() },
      );
      observer.observe(this.element.nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}

/**
 * appRevealSelected — on a horizontal chip row, scrolls the preselected chip
 * (`aria-pressed="true"`) to the centre once, after the first render, so a
 * selection made for the user (e.g. the current moment of the day) is never
 * hidden off-screen. Instant: it is a starting position, not motion.
 */
@Directive({ selector: '[appRevealSelected]', standalone: true })
export class RevealSelectedDirective {
  constructor() {
    const container = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => RevealSelectedDirective.reveal(container));
  }

  /** Centres the selected child horizontally when it is not fully visible. */
  public static reveal(container: HTMLElement): void {
    const selected = container.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!selected) return;
    const left = selected.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft;
    const right = left + selected.offsetWidth;
    const visible = left >= container.scrollLeft && right <= container.scrollLeft + container.clientWidth;
    if (!visible) container.scrollLeft = left - (container.clientWidth - selected.offsetWidth) * HALF;
  }
}
