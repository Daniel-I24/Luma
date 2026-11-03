import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, type ElementRef, Injector, afterNextRender, computed, effect, inject,
  signal, untracked, viewChild,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { HALF } from '@core/config/units';
import { LumaButton } from '@design-system';
import { GuidedTour } from '../guided-tour.service';

interface Box {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/** Room around the highlighted control and between it and the bubble (CSS px, measured at runtime). */
const GAP = 8;

/**
 * GuidedTourOverlay — dims the screen except the real control of the step
 * (found by its data-tour attribute), with a bubble saying what to do
 * ("Toca aquí", "Escribe aquí"), Atrás, Siguiente and Saltar. A dialog for
 * assistive tech; Escape skips; no movement with prefers-reduced-motion.
 * A step whose control is not on screen shows its bubble in the middle.
 */
@Component({
  selector: 'app-guided-tour-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton],
  templateUrl: './guided-tour-overlay.html',
  styleUrl: './guided-tour-overlay.css',
  host: { '(document:keydown.escape)': 'tour.skip()', '(window:resize)': 'measure()' },
})
export class GuidedTourOverlay {
  protected readonly tour = inject(GuidedTour);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly box = signal<Box | null>(null);
  protected readonly position = computed(() => this.tour.active()?.index ?? 0);
  /** The bubble goes below the control when it is in the top half of the screen. */
  protected readonly below = computed(() => {
    const box = this.box();
    return !box || box.top + box.height * HALF < (this.document.defaultView?.innerHeight ?? 0) * HALF;
  });
  /** Below the control, or above it (bottom offset); null in the middle of the screen. */
  protected readonly bubbleTop = computed(() => {
    const box = this.box();
    return box && this.below() ? box.top + box.height + GAP : null;
  });
  protected readonly bubbleBottom = computed(() => {
    const box = this.box();
    return box && !this.below() ? (this.document.defaultView?.innerHeight ?? 0) - box.top + GAP : null;
  });

  constructor() {
    effect(() => {
      const step = this.tour.step();
      untracked(() => (step ? this.focusStep(step.anchor) : this.box.set(null)));
    });
    const onScroll = (): void => this.measure();
    this.document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => this.document.removeEventListener('scroll', onScroll, { capture: true }));
  }

  /** Re-reads where the control is (scroll, resize). */
  protected measure(): void {
    const anchor = this.tour.step()?.anchor;
    const element = anchor ? this.anchorElement(anchor) : null;
    const rect = element?.getBoundingClientRect();
    this.box.set(rect && rect.width > 0 ? { top: rect.top - GAP, left: rect.left - GAP, width: rect.width + GAP + GAP, height: rect.height + GAP + GAP } : null);
  }

  private focusStep(anchor: string): void {
    const reduce = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.anchorElement(anchor)?.scrollIntoView?.({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    this.measure();
    afterNextRender(
      {
        read: () => {
          this.measure();
          this.heading()?.nativeElement.focus();
        },
      },
      { injector: this.injector },
    );
  }

  private anchorElement(anchor: string): HTMLElement | null {
    return this.document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
  }
}
