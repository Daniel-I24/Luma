import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaBottomSheet, LumaButton } from '@design-system';

/** ReReviewSheet — warns that changing name, address or location sends a verified business back to review. */
@Component({
  selector: 'app-re-review-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaBottomSheet, LumaButton],
  template: `
    <app-luma-bottom-sheet
      *transloco="let t"
      titleId="re-review-title"
      [open]="open()"
      [title]="t('owner.reReview.title')"
      (closed)="cancelled.emit()"
    >
      <div class="flex flex-col gap-3">
        <p class="m-0 text-body text-fg">{{ t('owner.reReview.body') }}</p>
        <app-luma-button [fullWidth]="true" (clicked)="confirmed.emit()">
          {{ t('owner.reReview.confirm') }}
        </app-luma-button>
        <app-luma-button variant="ghost" [fullWidth]="true" (clicked)="cancelled.emit()">
          {{ t('owner.reReview.cancel') }}
        </app-luma-button>
      </div>
    </app-luma-bottom-sheet>
  `,
})
export class ReReviewSheet {
  readonly open = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
