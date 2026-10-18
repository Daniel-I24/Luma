import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaIcon, ToastService } from '@design-system';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { ONBOARDING_AUDIENCE, ONBOARDING_SLIDES } from './onboarding-slides';

/**
 * WelcomePage — /welcome: four swipeable screens for the account type (CSS
 * scroll snap, so swiping is native), "Omitir" and "Empezar". Shown once per
 * tutorial version after signing in; the Profile opens it again.
 */
@Component({
  selector: 'app-welcome-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaIcon],
  templateUrl: './welcome.page.html',
  host: { class: 'block min-h-dvh bg-canvas' },
})
export class WelcomePage {
  private readonly session = inject(SessionProfileStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  private readonly type = computed(() => this.session.accountType()?.value ?? 'customer');
  protected readonly slides = computed(() => ONBOARDING_SLIDES[this.type()]);
  protected readonly audience = computed(() => ONBOARDING_AUDIENCE[this.type()]);
  protected readonly index = signal(0);
  protected readonly isLast = computed(() => this.index() === this.slides().length - 1);
  protected readonly finishing = signal(false);

  /** Follows the swipe: the slide whose start is closest to the scroll position. */
  protected onScroll(): void {
    const track = this.track().nativeElement;
    const width = track.clientWidth || 1;
    this.index.set(
      Math.min(this.slides().length - 1, Math.round(Math.abs(track.scrollLeft) / width)),
    );
  }

  protected goTo(index: number): void {
    const track = this.track().nativeElement;
    const reduce = this.document.defaultView?.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    track.scrollTo({ left: index * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    this.index.set(index);
  }

  protected next(): void {
    if (this.isLast()) void this.finish();
    else this.goTo(this.index() + 1);
  }

  /** "Omitir" and "Empezar": both count as seen; a failed save never traps the user. */
  protected async finish(): Promise<void> {
    if (this.finishing()) return;
    this.finishing.set(true);
    const saved = await this.session.markOnboardingSeen();
    if (!saved) this.toast.show({ messageKey: 'onboarding.saveFailed', tone: 'info' });
    await this.router.navigateByUrl(await this.session.homePath());
    this.finishing.set(false);
  }
}
