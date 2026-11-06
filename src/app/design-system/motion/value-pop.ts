import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, effect, inject, input, untracked } from '@angular/core';

const DURATION_MS = 260;
const FRAMES: Keyframe[] = [
  { opacity: 0.35, transform: 'translateY(35%)' },
  { opacity: 1, transform: 'translateY(0)' },
];

/**
 * ValuePop — a number that changed (a total, a price, a counter) rises into
 * place, so the eye catches it. Only opacity and transform, on the compositor;
 * nothing under reduced motion, and never on the first value.
 */
@Directive({
  selector: '[appValuePop]',
  standalone: true,
  host: { class: 'inline-block' },
})
export class ValuePop {
  /** The value to watch. */
  public readonly appValuePop = input.required<unknown>();

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly view = inject(DOCUMENT).defaultView;

  constructor() {
    let first = true;
    let last: unknown;
    effect(() => {
      const value = this.appValuePop();
      const changed = !first && value !== last;
      first = false;
      last = value;
      if (changed) untracked(() => this.play());
    });
  }

  private play(): void {
    if (this.view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    this.element.animate?.(FRAMES, { duration: DURATION_MS, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
  }
}
