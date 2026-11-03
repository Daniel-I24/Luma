import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, type ElementRef, computed, inject, input, output, signal, viewChild,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaIcon } from '@design-system';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { ONBOARDING_AUDIENCE, ONBOARDING_SLIDES } from '../onboarding-slides';

/**
 * WelcomeSlides — four swipeable screens for the account type (CSS scroll
 * snap, so swiping is native), "Omitir" and "Empezar". Used by /welcome
 * (first start on the device) and over any screen from "Ver tutorial".
 */
@Component({
  selector: 'app-welcome-slides',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaIcon],
  templateUrl: './welcome-slides.html',
})
export class WelcomeSlides {
  private readonly session = inject(SessionProfileStore);
  private readonly document = inject(DOCUMENT);
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  /** True while the screen behind is being opened ("Omitir" and "Empezar" wait). */
  public readonly busy = input(false);
  /** "Omitir" or "Empezar". */
  public readonly finished = output<void>();

  private readonly type = computed(() => this.session.accountType()?.value ?? 'customer');
  protected readonly slides = computed(() => ONBOARDING_SLIDES[this.type()]);
  protected readonly audience = computed(() => ONBOARDING_AUDIENCE[this.type()]);
  protected readonly index = signal(0);
  protected readonly isLast = computed(() => this.index() === this.slides().length - 1);

  /** Follows the swipe: the slide whose start is closest to the scroll position. */
  protected onScroll(): void {
    const track = this.track().nativeElement;
    const width = track.clientWidth || 1;
    this.index.set(Math.min(this.slides().length - 1, Math.round(Math.abs(track.scrollLeft) / width)));
  }

  protected goTo(index: number): void {
    const track = this.track().nativeElement;
    const reduce = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({ left: index * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    this.index.set(index);
  }

  protected next(): void {
    if (this.isLast()) this.finished.emit();
    else this.goTo(this.index() + 1);
  }
}
