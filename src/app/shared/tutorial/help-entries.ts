import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { type IconName, LumaIcon } from '@design-system';

/**
 * HelpEntries — "Ayuda y legal" with only two entries, in the Profile and in
 * Mi negocio: "Tutoriales" (one screen with every guide) and "Legal" (one
 * screen with tabs: Términos, Privacidad, Reembolsos).
 */
@Component({
  selector: 'app-help-entries',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaIcon],
  template: `
    <section *transloco="let t" class="flex flex-col gap-2" aria-labelledby="help-heading">
      <h2 id="help-heading" class="m-0 px-1 pt-4 pb-2 text-label tracking-wide text-fg-subtle uppercase">
        {{ t('profile.help.section') }}
      </h2>
      @for (entry of entries(); track entry.key) {
        <a [routerLink]="entry.link" [class]="rowClass">
          <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-selected text-fg-brand">
            <app-luma-icon [name]="entry.icon" />
          </span>
          <span class="flex-1 text-body font-medium">{{ t('profile.help.' + entry.key) }}</span>
          <app-luma-icon class="-rotate-90 text-fg-subtle" name="chevron-down" size="sm" />
        </a>
      }
    </section>
  `,
  host: { 'data-tour': 'profile-help' },
})
export class HelpEntries {
  /** /tutorials for customers, /owner/:id/tutorials in Luma Negocios. */
  public readonly tutorialsLink = input('/tutorials');
  protected readonly entries = computed<readonly { link: string; key: string; icon: IconName }[]>(() => [
    { link: this.tutorialsLink(), key: 'tutorials', icon: 'compass' },
    { link: '/legal/terms', key: 'legal', icon: 'info' },
  ]);
  protected readonly rowClass =
    'pressable flex min-h-14 items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 text-fg no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus';
}
