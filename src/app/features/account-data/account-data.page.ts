import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaButton, LumaNotice, LumaScreenHeader, LumaSkeleton, ToastService, LumaRefreshButton } from '@design-system';
import { DataExport, type MyData } from './services/data-export.service';
import { DataReport } from './utils/data-report';

/** How many lines of each section the summary shows; the file has them all. */
const PREVIEW_LINES = 3;

/**
 * AccountDataPage — /account/data, the right of access of Ley 1581 de 2012: says
 * what it is for, shows a summary a person can read, and offers the whole file as
 * a second step. The copy is read once per visit.
 */
@Component({
  selector: 'app-account-data-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaScreenHeader, LumaRefreshButton, TranslocoModule, LumaButton, LumaNotice, LumaSkeleton],
  templateUrl: './account-data.page.html',
  host: { class: 'block' },
})
export class AccountDataPage {
  private readonly exporter = inject(DataExport);
  private readonly transloco = inject(TranslocoService);
  private readonly toast = inject(ToastService);

  protected readonly data = signal<MyData | null>(null);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly preview = PREVIEW_LINES;
  protected readonly sections = computed(() => {
    const data = this.data();
    return data ? this.report().sections(data) : [];
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorKey.set(null);
    const { data, errorKey } = await this.exporter.read();
    this.data.set(data);
    this.errorKey.set(errorKey);
    this.loading.set(false);
  }

  protected async download(): Promise<void> {
    const data = this.data();
    if (!data || this.saving()) return;
    this.saving.set(true);
    try {
      const delivered = await this.exporter.deliver(this.report().text(data));
      this.toast.show({ messageKey: `account.data.done.${delivered}`, tone: 'success' });
    } catch {
      this.errorKey.set('account.data.errors.failed');
    } finally {
      this.saving.set(false);
    }
  }

  private report(): DataReport {
    return new DataReport((key, params) => this.transloco.translate(key, params), this.transloco.getActiveLang());
  }
}
