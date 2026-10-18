import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIcon } from '@design-system';
import { AdminRepository } from '@shared/business/verification/admin.repository';

/**
 * AdminEntry — Profile link to /admin. Renders nothing unless the server says
 * the user is in the review team (am_i_admin); the route checks it again.
 */
@Component({
  selector: 'app-admin-entry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaIcon],
  template: `
    @if (isAdmin()) {
      <section *transloco="let t" aria-labelledby="admin-heading">
        <h2 id="admin-heading" class="m-0 px-1 pt-4 pb-2 text-label tracking-wide text-fg-subtle uppercase">
          {{ t('admin.entry') }}
        </h2>
        <a
          routerLink="/admin"
          class="pressable flex min-h-14 items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 text-fg no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        >
          <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-selected text-fg-brand">
            <app-luma-icon name="check" />
          </span>
          <span class="flex-1 text-body font-medium">{{ t('admin.entryHint') }}</span>
          <app-luma-icon class="-rotate-90 text-fg-subtle" name="chevron-down" size="sm" />
        </a>
      </section>
    }
  `,
})
export class AdminEntry {
  private readonly repo = inject(AdminRepository);
  protected readonly isAdmin = signal(false);

  constructor() {
    void this.repo.amIAdmin().then((admin) => this.isAdmin.set(admin));
  }
}
