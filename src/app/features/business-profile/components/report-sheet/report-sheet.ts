import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaBottomSheet, LumaButton, ToastService } from '@design-system';
import { FieldRules } from '@core/validation/field-rule';
import { REPORT_COMMENT_RULE, ReportRepository } from '@shared/business/verification/report.repository';
import { REPORT_REASONS, type ReportReason } from '@shared/business/verification/verification.model';


/**
 * ReportSheet — "Reportar" button and its bottom sheet: a reason and an
 * optional comment. The business never learns who reported it.
 */
@Component({
  selector: 'app-report-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaBottomSheet, LumaButton],
  template: `
    <ng-container *transloco="let t">
      <app-luma-button variant="ghost" size="sm" (clicked)="open.set(true)">{{ t('reports.action') }}</app-luma-button>
      <app-luma-bottom-sheet titleId="report-sheet-title" [open]="open()" [title]="t('reports.title')" (closed)="close()">
        <div class="flex flex-col gap-3">
          <p class="m-0 text-body text-fg-muted">{{ t('reports.intro') }}</p>
          <fieldset class="m-0 flex flex-col gap-1 border-0 p-0">
            <legend class="mb-1 text-label-lg text-fg">{{ t('reports.reasonLabel') }}</legend>
            @for (option of reasons; track option) {
            <label
              class="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border-2 border-border-subtle px-3 text-body text-fg hover:bg-canvas-subtle has-checked:border-primary has-checked:bg-surface-selected has-focus-visible:outline-2 has-focus-visible:outline-border-focus"
            >
              <input class="sr-only" type="radio" name="report-reason" [value]="option" [checked]="reason() === option" (change)="reason.set(option)" />
              {{ t('reports.reasons.' + option) }}
            </label>
            }
          </fieldset>
          <label class="text-label-lg text-fg" for="report-comment">{{ t('reports.comment') }}</label>
          <textarea
            id="report-comment"
            [placeholder]="t('placeholders.reportComment')"
            rows="3"
            class="w-full resize-y rounded-md border border-border bg-surface p-3 text-body text-fg focus-visible:outline-2 focus-visible:outline-border-focus"
            aria-describedby="report-comment-count"
            [attr.aria-invalid]="commentError() ? 'true' : null"
            [attr.maxlength]="commentMax"
            [value]="comment()"
            (input)="onComment($event)"
          ></textarea>
          <p id="report-comment-count" class="m-0 text-right text-caption text-fg-subtle">
            @if (commentError(); as key) { {{ t(key) }} } @else { {{ t('reviews.form.counter', { count: comment().length, max: commentMax }) }} }
          </p>
          @if (errorKey(); as key) {
          <p class="m-0 rounded-md bg-danger-bg p-3 text-body-sm text-danger-fg" role="alert">{{ t(key) }}</p>
          }
          <app-luma-button [fullWidth]="true" [disabled]="!reason() || sending() || !!commentError()" (clicked)="send()">{{ t('reports.send') }}</app-luma-button>
        </div>
      </app-luma-bottom-sheet>
    </ng-container>
  `,
})
export class ReportSheet {
  private readonly repo = inject(ReportRepository);
  private readonly toast = inject(ToastService);

  public readonly businessId = input.required<string>();

  protected readonly reasons = REPORT_REASONS;
  protected readonly commentMax = REPORT_COMMENT_RULE.maxLength;
  protected readonly open = signal(false);
  protected readonly reason = signal<ReportReason | null>(null);
  protected readonly comment = signal('');
  protected readonly sending = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly commentError = computed(() => (this.comment().trim() ? FieldRules.check(REPORT_COMMENT_RULE, this.comment()) : null));

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
