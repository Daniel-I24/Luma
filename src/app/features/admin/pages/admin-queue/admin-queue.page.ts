import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  LumaButton,
  LumaEmptyState,
  LumaIconButton,
  LumaSkeleton,
  LumaTabs,
  type TabItem,
  tabPanelId,
} from '@design-system';
import { formatDateTime } from '@shared/format/date-format.util';
import { AdminQueueStore } from '../../state/admin-queue.store';

type QueueTab = 'pending' | 'reports';

/** AdminQueuePage — /admin: businesses waiting for review and open reports. */
@Component({
  selector: 'app-admin-queue-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaButton, LumaEmptyState, LumaIconButton, LumaSkeleton, LumaTabs],
  providers: [AdminQueueStore],
  templateUrl: './admin-queue.page.html',
  host: { class: 'block' },
})
export class AdminQueuePage {
  protected readonly store = inject(AdminQueueStore);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly tab = signal<QueueTab>('pending');
  protected readonly panelId = tabPanelId;
  protected readonly tabs = computed<TabItem[]>(() => {
    this.lang();
    return [
      { id: 'pending', label: this.transloco.translate('admin.queue.pending', { count: this.store.pending().length }) },
      { id: 'reports', label: this.transloco.translate('admin.queue.reports', { count: this.store.reports().length }) },
    ];
  });

  constructor() {
    void this.store.load();
  }

  protected when(iso: string): string {
    return formatDateTime(iso, this.lang());
  }

  protected back(): void {
    void this.router.navigate(['/profile']);
  }
}
