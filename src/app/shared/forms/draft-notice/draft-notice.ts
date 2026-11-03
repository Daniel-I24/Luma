import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import type { RestorableDraft } from '../form-draft.store';

/** DraftNotice — "Recuperamos tu borrador" with "Descartar", shown while a restored draft is on screen. */
@Component({
  selector: 'app-draft-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
  template: `
    @if (draft().restored()) {
      <p
        *transloco="let t"
        class="m-0 flex flex-wrap items-center gap-2 rounded-md bg-info-bg p-3 text-body-sm text-info-fg"
        role="status"
      >
        <span class="flex-1">{{ t('forms.draft.restored') }}</span>
        <button
          type="button"
          class="min-h-11 rounded-md px-3 font-semibold text-info-fg underline focus-visible:outline-2 focus-visible:outline-border-focus"
          (click)="draft().discard()"
        >
          {{ t('forms.draft.discard') }}
        </button>
      </p>
    }
  `,
})
export class DraftNotice {
  public readonly draft = input.required<RestorableDraft>();
}
