import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaButton, LumaEmptyState, LumaIconButton, LumaNotice, LumaSkeleton, LumaTabs, TabIds, type TabItem, LumaRefreshButton, LumaScreenHeader } from '@design-system';
import { DateFormat } from '@shared/format/date-format';
import { ContactQueue } from '../../components/contact-queue/contact-queue';
import { AdminQueueStore } from '../../state/admin-queue.store';

type QueueTab = 'pending' | 'reports';

/** AdminQueuePage — /admin: businesses waiting for review, open reports and contacts to verify. */
@Component({
  selector: 'app-admin-queue-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaScreenHeader, LumaRefreshButton, LumaNotice, 
    TranslocoModule,
    RouterLink,
    LumaButton,
    LumaEmptyState,
    LumaIconButton,
    LumaSkeleton,
    LumaTabs,
    ContactQueue,
  ],
  providers: [AdminQueueStore],
  templateUrl: './admin-queue.page.html',
  host: { class: 'block' },
})
export class AdminQueuePage {
  protected readonly store = inject(AdminQueueStore);
  private readonly router = inject(Router);
  private readonly account = inject(SessionProfileStore);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly tab = signal<QueueTab>('pending');
  protected readonly panelId = TabIds.tabPanelId;
  protected readonly tabs = computed<TabItem[]>(() => {
    this.lang();
    return [
      {
        id: 'pending',
        label: this.transloco.translate('admin.queue.pending', {
          count: this.store.pending().length,
        }),
      },
      {
        id: 'reports',
        label: this.transloco.translate('admin.queue.reports', {
          count: this.store.reports().length,
        }),
      },
    ];
  });

  constructor() {
    void this.store.load();
  }

  protected when(iso: string): string {
    return DateFormat.formatDateTime(iso, this.lang());
  }

  /** The admin came from their profile (owners from their panel). */
  protected backLink(): string[] {
    return [this.account.isBusinessOwner() ? '/owner' : '/profile'];
  }

  protected openOperations(): void {
    void this.router.navigate(['/admin', 'operations']);
  }
}
