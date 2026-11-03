import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';
import { HALF } from '@core/config/units';

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
