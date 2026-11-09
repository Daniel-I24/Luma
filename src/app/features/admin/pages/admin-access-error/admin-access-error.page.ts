import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaNotice, LumaRefreshButton } from '@design-system';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { AdminRepository } from '@shared/business/verification/admin.repository';

/**
 * AdminAccessErrorPage — /admin/access-error. The review team's access could
 * not be checked: says so with the error code and "Reintentar", which runs the
 * guards of /admin again. Being here grants nothing: the database decides.
 */
@Component({
  selector: 'app-admin-access-error-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaRefreshButton, TranslocoModule, LumaButton, LumaNotice],
  template: `
    <div
      *transloco="let t"
      class="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-[calc(env(safe-area-inset-top)+var(--spacing-6))] pb-6"
    >
      <h1 class="m-0 text-h2 text-fg">{{ t('admin.accessError.title') }}</h1>
      <app-luma-notice tone="danger">{{ t('admin.accessError.message') }}</app-luma-notice>
      <p class="m-0 font-mono text-caption text-fg-muted">{{ t('admin.accessError.code') }}: {{ code() }}</p>
      <app-luma-refresh-button [busy]="busy()" (clicked)="retry()" />
      <app-luma-button variant="ghost" [fullWidth]="true" (clicked)="leave()">{{ t('admin.accessError.back') }}</app-luma-button>
    </div>
  `,
  host: { class: 'block' },
})
export class AdminAccessErrorPage {
  private readonly router = inject(Router);
  private readonly account = inject(SessionProfileStore);
  private readonly repo = inject(AdminRepository);
  protected readonly busy = signal(false);
  protected readonly code = computed(() => this.repo.lastAccess()?.code ?? 'unknown');

  protected async retry(): Promise<void> {
    this.busy.set(true);
    try {
      await this.router.navigateByUrl('/admin');
    } finally {
      this.busy.set(false);
    }
  }

  protected async leave(): Promise<void> {
    await this.router.navigateByUrl(await this.account.homePath());
  }
}
