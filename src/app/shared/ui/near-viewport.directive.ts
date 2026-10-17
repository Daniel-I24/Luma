import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input, output } from '@angular/core';

/**
 * appNearViewport — emits `nearViewport` when the element comes within
 * `margin` of the scroll container (IntersectionObserver), e.g. to load the
 * next page before the user reaches the end of a list.
 */
@Directive({ selector: '[appNearViewport]', standalone: true })
export class NearViewportDirective {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Scroll container to measure against (null: the viewport). */
  readonly root = input<HTMLElement | null>(null);
  /** How far ahead to trigger, as a CSS margin (default: one screen). */
  readonly margin = input('100% 0px');
  readonly nearViewport = output<void>();

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
