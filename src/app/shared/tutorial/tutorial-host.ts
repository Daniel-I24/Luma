import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { BackNavigation } from '@core/navigation/back-navigation';
import { GuidedTour } from './guided-tour.service';
import { GuidedTourOverlay } from './guided-tour-overlay/guided-tour-overlay';
import { TourRoutes } from './tour-registry';
import { WelcomeSlides } from './welcome-slides/welcome-slides';

/** Lets the screen draw its controls before the guide looks for them. */
const TOUR_START_DELAY_MS = 700;

/**
 * TutorialHost — once, in the app root: starts the guide of a section on its
 * first visit (per device and user), shows the guide overlay, and shows the
 * welcome screens over the current screen when "Ver tutorial" asks for them.
 * Tutorials never navigate: what is on screen (a form, a cart) stays as it is.
 */
@Component({
  selector: 'app-tutorial-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuidedTourOverlay, WelcomeSlides],
  template: `
    <app-guided-tour-overlay />
    @if (tour.welcomeOpen()) {
      <div class="fixed inset-0 z-50 overflow-y-auto bg-canvas" role="dialog" aria-modal="true">
        <app-welcome-slides (finished)="tour.closeWelcome()" />
      </div>
    }
  `,
})
export class TutorialHost {
  protected readonly tour = inject(GuidedTour);
  private readonly auth = inject(AuthService);
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** The welcome screens or a guide on screen: back closes them first. */
  private readonly showing = computed(() => this.tour.welcomeOpen() || this.tour.active() !== null);

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.cancel());
    const back = inject(BackNavigation);
    let release: (() => void) | null = null;
    effect(() => {
      if (!this.showing()) return void (release?.(), (release = null));
      release ??= untracked(() => back.openLayer(() => (this.tour.welcomeOpen() ? this.tour.closeWelcome() : this.tour.skip())));
    });
    destroyRef.onDestroy(() => release?.());
    const router = inject(Router);
    // Loaded after the first screen (@defer): that screen counts as visited now.
    this.onNavigated(router.url);
    router
      .events.pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed(destroyRef))
      .subscribe((event) => this.onNavigated(event.urlAfterRedirects));
  }

  private onNavigated(url: string): void {
    this.cancel();
    // A guide belongs to its screen: leaving closes it.
    this.tour.skip();
    const id = TourRoutes.tourForUrl(url);
    if (!id || !this.auth.user() || this.tour.seen(id)) return;
    this.timer = setTimeout(() => this.tour.startIfFirstVisit(id), TOUR_START_DELAY_MS);
  }

  private cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
