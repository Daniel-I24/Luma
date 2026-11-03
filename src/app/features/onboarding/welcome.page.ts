import { ChangeDetectionStrategy, Component, ErrorHandler, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { WelcomeTutorial } from '@shared/account/onboarding';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { WelcomeSlides } from '@shared/tutorial/welcome-slides/welcome-slides';

/**
 * WelcomePage — /welcome: the welcome screens the FIRST time the app is
 * opened on a device (not at every sign-in). Settings → "Ver tutorial" shows
 * the same screens over the current screen instead (TutorialHost).
 */
@Component({
  selector: 'app-welcome-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WelcomeSlides],
  template: `<app-welcome-slides [busy]="finishing()" (finished)="finish()" />`,
  host: { class: 'block min-h-dvh bg-canvas' },
})
export class WelcomePage {
  private readonly session = inject(SessionProfileStore);
  private readonly router = inject(Router);
  private readonly welcome = inject(WelcomeTutorial);
  private readonly errors = inject(ErrorHandler);
  protected readonly finishing = signal(false);

  /** "Omitir" and "Empezar": both count as seen; a failed navigation never leaves the buttons disabled. */
  protected async finish(): Promise<void> {
    if (this.finishing()) return;
    this.finishing.set(true);
    this.welcome.markSeen();
    try {
      await this.router.navigateByUrl(await this.session.homePath());
    } catch (error) {
      this.errors.handleError(error);
    } finally {
      this.finishing.set(false);
    }
  }
}
