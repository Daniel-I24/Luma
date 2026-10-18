import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaBottomSheet, LumaButton, ToastService } from '@design-system';
import { ReportRepository } from '@shared/business/verification/report.repository';
import { REPORT_REASONS, type ReportReason } from '@shared/business/verification/verification.model';

export const REPORT_COMMENT_MAX = 300;

/**
 * ReportSheet — "Reportar" button and its bottom sheet: a reason and an
 * optional comment. The business never learns who reported it.
 */
@Component({
  selector: 'app-report-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaBottomSheet, LumaButton],
  templateUrl: './report-sheet.html',
})
export class ReportSheet {
  private readonly repo = inject(ReportRepository);
  private readonly toast = inject(ToastService);

  readonly businessId = input.required<string>();

  protected readonly reasons = REPORT_REASONS;
  protected readonly commentMax = REPORT_COMMENT_MAX;
  protected readonly open = signal(false);
  protected readonly reason = signal<ReportReason | null>(null);
  protected readonly comment = signal('');
  protected readonly sending = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected onComment(event: Event): void {
    this.comment.set((event.target as HTMLTextAreaElement).value);
  }

  protected close(): void {
    this.open.set(false);
    this.errorKey.set(null);
  }

  protected async send(): Promise<void> {
    const reason = this.reason();
    if (!reason || this.sending()) return;
    this.sending.set(true);
    this.errorKey.set(null);
    try {
      const result = await this.repo.create(this.businessId(), reason, this.comment());
      if (result.errorKey) {
        this.errorKey.set(result.errorKey);
        return;
      }
      this.toast.show({ messageKey: 'reports.sent', tone: 'success' });
      this.reason.set(null);
      this.comment.set('');
      this.open.set(false);
    } finally {
      this.sending.set(false);
    }
  }
}
