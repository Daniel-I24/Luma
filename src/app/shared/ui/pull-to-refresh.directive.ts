import { Directive, ElementRef, inject, output } from '@angular/core';

/** How far (px) the list must be pulled down from the top. */
const PULL_PX = 72;

/**
 * appPullToRefresh — pulling a list down from its top emits `pullRefresh`.
 * The page's FreshnessNote has the "Actualizar" button for the same thing
 * with one tap (no gesture needed).
 */
@Directive({
  selector: '[appPullToRefresh]',
  standalone: true,
  host: {
    '(touchstart)': 'start($event)',
    '(touchend)': 'end($event)',
  },
})
export class PullToRefreshDirective {
  public readonly pullRefresh = output<void>();
  private readonly element = inject(ElementRef<HTMLElement>);
  private startY: number | null = null;

  protected start(event: TouchEvent): void {
    const atTop = (this.element.nativeElement.scrollTop ?? 0) <= 0 && (globalThis.scrollY ?? 0) <= 0;
    this.startY = atTop ? (event.touches[0]?.clientY ?? null) : null;
  }

  protected end(event: TouchEvent): void {
    const endY = event.changedTouches[0]?.clientY;
    if (this.startY !== null && endY !== undefined && endY - this.startY >= PULL_PX) this.pullRefresh.emit();
    this.startY = null;
  }
}
