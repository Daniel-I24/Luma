import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { FieldRules } from '@core/validation/field-rule';
import { LumaButton, LumaIcon, LumaNotice } from '@design-system';
import type { ReviewInput, ReviewWithAuthor } from '@shared/business/models/review.model';
import { REVIEW_COMMENT_RULE } from '@shared/business/data/review.schema';

const STAR_COUNT = 5;

const MAX_COMMENT_LENGTH = REVIEW_COMMENT_RULE.maxLength;

/**
 * ReviewForm — write or edit the user's own review: 1–5 stars (native radio
 * group, keyboard friendly), optional comment with a live 500-character
 * counter, and delete with a confirmation step.
 */
@Component({
  selector: 'app-review-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaNotice, TranslocoModule, LumaButton, LumaIcon],
  templateUrl: './review-form.html',
  host: { class: 'block' },
})
export class ReviewForm {
  public readonly existing = input<ReviewWithAuthor | null>(null);
  public readonly saving = input(false);
  /** i18n key of the last save/delete error. */
  public readonly errorKey = input<string | null>(null);

  public readonly submitted = output<ReviewInput>();
  public readonly deleted = output<void>();

  protected readonly maxLength = MAX_COMMENT_LENGTH;
  protected readonly stars = Array.from({ length: STAR_COUNT }, (_, i) => i + 1);
  protected readonly rating = linkedSignal(() => this.existing()?.rating ?? 0);
  protected readonly comment = linkedSignal(() => this.existing()?.comment ?? '');
  protected readonly confirmingDelete = signal(false);
  protected readonly remaining = computed(() => this.maxLength - this.comment().length);
  protected readonly commentError = computed(() => (this.comment().trim() ? FieldRules.check(REVIEW_COMMENT_RULE, this.comment()) : null));
  protected readonly canSubmit = computed(() => this.rating() >= 1 && !this.saving());

  protected onComment(event: Event): void {
    this.comment.set((event.target as HTMLTextAreaElement).value.slice(0, this.maxLength));
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit() || this.commentError()) return;
    this.submitted.emit({ rating: this.rating(), comment: REVIEW_COMMENT_RULE.normalize(this.comment()) });
  }

  protected confirmDelete(): void {
    this.confirmingDelete.set(false);
    this.deleted.emit();
  }
}
