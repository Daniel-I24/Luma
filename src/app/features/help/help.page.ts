import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { APP_VERSION } from '@core/config/app-version';
import { LumaButton, LumaDisclosure } from '@design-system';

/** Questions answered on /help, in display order (texts in help.faq.<key>). */
const QUESTIONS = ['order', 'pay', 'cancel', 'business', 'review', 'notifications', 'data', 'delete'] as const;

/** HelpPage — /help: frequent questions, legal links and the app version. Public. */
@Component({
  selector: 'app-help-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaButton, LumaDisclosure],
  template: `
    <main
      *transloco="let t"
      class="mx-auto flex min-h-dvh max-w-lg flex-col gap-3 bg-canvas px-4 pt-[calc(env(safe-area-inset-top)+var(--spacing-6))] pb-6"
    >
      <h1 class="m-0 text-h2 text-fg">{{ t('help.title') }}</h1>
      @for (key of questions; track key) {
        <app-luma-disclosure icon="info" [panelId]="'help-' + key" [heading]="t('help.faq.' + key + '.q')">
          <p class="m-0 text-body text-fg-muted">{{ t('help.faq.' + key + '.a') }}</p>
        </app-luma-disclosure>
      }
      <nav class="mt-2 flex flex-wrap gap-4 text-body-sm" [attr.aria-label]="t('help.legal')">
        <a routerLink="/legal/terms" class="inline-flex min-h-11 items-center text-fg-brand">{{ t('profile.help.terms') }}</a>
        <a routerLink="/legal/privacy" class="inline-flex min-h-11 items-center text-fg-brand">{{ t('profile.help.privacy') }}</a>
        <a routerLink="/legal/refunds" class="inline-flex min-h-11 items-center text-fg-brand">{{ t('profile.help.refunds') }}</a>
      </nav>
      <p class="m-0 text-caption text-fg-subtle">{{ t('help.version', { version }) }}</p>
      <app-luma-button variant="ghost" (clicked)="back()">{{ t('common.back') }}</app-luma-button>
    </main>
  `,
})
export class HelpPage {
  private readonly location = inject(Location);
  protected readonly questions = QUESTIONS;
  protected readonly version = APP_VERSION;

  protected back(): void {
    this.location.back();
  }
}
