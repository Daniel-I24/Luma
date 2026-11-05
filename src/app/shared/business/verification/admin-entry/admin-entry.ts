import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaIcon, LumaNotice } from '@design-system';
import { type AdminAccess, AdminRepository } from '../admin.repository';

/**
 * AdminEntry — link to /admin, in the Profile and in Mi negocio. Renders nothing
 * unless the server says the user is in the review team (admin_access, MFA
 * pending or done); the route checks it again and asks for the TOTP code when
 * needed. When the check fails it says so, with a retry: an admin must never
 * look like a regular user because of a failed request.
 */
@Component({
  selector: 'app-admin-entry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaButton, LumaIcon, LumaNotice],
  template: `
    @if (access() === 'ok' || access() === 'needs_mfa') {
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
    } @else if (access() === 'error') {
      <section *transloco="let t" class="flex flex-col gap-2 pt-4">
        <app-luma-notice tone="warning">{{ t('admin.accessError.entry') }}</app-luma-notice>
        <app-luma-button variant="secondary" size="sm" [disabled]="checking()" (clicked)="check()">
          {{ t('common.retry') }}
        </app-luma-button>
      </section>
    }
  `,
})
export class AdminEntry {
  private readonly repo = inject(AdminRepository);
  protected readonly access = signal<AdminAccess>('none');
  protected readonly checking = signal(false);

  constructor() {
    void this.check();
  }

  /** Reads the access again; AdminRepository.access() never rejects. */
  protected async check(): Promise<void> {
    this.checking.set(true);
    this.access.set(await this.repo.access());
    this.checking.set(false);
  }
}
