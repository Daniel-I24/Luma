import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { type IconName, LumaIcon } from '@design-system';
import { ONBOARDING_PATH } from '@shared/account/onboarding';

const LINKS: readonly { path: string; key: string; icon: IconName }[] = [
  { path: ONBOARDING_PATH, key: 'tutorial', icon: 'sparkles' },
  { path: '/legal/terms', key: 'terms', icon: 'info' },
  { path: '/legal/privacy', key: 'privacy', icon: 'info' },
];

/** HelpLinks — Profile section: watch the tutorial again, terms and privacy policy. */
@Component({
  selector: 'app-help-links',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaIcon],
  template: `
    <section *transloco="let t" class="flex flex-col gap-2" aria-labelledby="help-heading">
      <h2
        id="help-heading"
        class="m-0 px-1 pt-4 pb-2 text-label tracking-wide text-fg-subtle uppercase"
      >
        {{ t('profile.help.section') }}
      </h2>
      @for (link of links; track link.key) {
        <a
          [routerLink]="link.path"
          class="pressable flex min-h-14 items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 text-fg no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        >
          <span
            class="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-selected text-fg-brand"
          >
            <app-luma-icon [name]="link.icon" />
          </span>
          <span class="flex-1 text-body font-medium">{{ t('profile.help.' + link.key) }}</span>
          <app-luma-icon class="-rotate-90 text-fg-subtle" name="chevron-down" size="sm" />
        </a>
      }
    </section>
  `,
})
export class HelpLinks {
  protected readonly links = LINKS;
}
