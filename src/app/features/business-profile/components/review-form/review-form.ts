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
import { LumaButton, LumaIcon } from '@design-system';
import type { ReviewInput, ReviewWithAuthor } from '@shared/business/models/review.model';

export const MAX_COMMENT_LENGTH = 500;

/**
 * ReviewForm — write or edit the user's own review: 1–5 stars (native radio
 * group, keyboard friendly), optional comment with a live 500-character
 * counter, and delete with a confirmation step.
 */
@Component({
  selector: 'app-review-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaIcon],
  templateUrl: './review-form.html',
  host: { class: 'block' },
})
export class ReviewForm {
  readonly existing = input<ReviewWithAuthor | null>(null);
  readonly saving = input(false);
  /** i18n key of the last save/delete error. */
  readonly errorKey = input<string | null>(null);

  readonly submitted = output<ReviewInput>();
  readonly deleted = output<void>();

  protected readonly maxLength = MAX_COMMENT_LENGTH;
  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly rating = linkedSignal(() => this.existing()?.rating ?? 0);
  protected readonly comment = linkedSignal(() => this.existing()?.comment ?? '');
  protected readonly confirmingDelete = signal(false);
  protected readonly remaining = computed(() => this.maxLength - this.comment().length);
  protected readonly canSubmit = computed(() => this.rating() >= 1 && !this.saving());

  protected onComment(event: Event): void {
    this.comment.set((event.target as HTMLTextAreaElement).value.slice(0, this.maxLength));
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit()) return;
    this.submitted.emit({ rating: this.rating(), comment: this.comment() });
  }

  protected confirmDelete(): void {
    this.confirmingDelete.set(false);
    this.deleted.emit();
  }
}
