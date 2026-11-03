import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaBottomSheet, LumaButton } from '@design-system';
import type { ReviewDecision } from '@shared/business/verification/verification.model';

const NOTE_MAX = 300;

/**
 * ReviewDecision — confirms an admin decision. Rejecting or suspending needs
 * a note for the business (the database requires it too).
 */
@Component({
  selector: 'app-review-decision',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaBottomSheet, LumaButton],
  template: `
    <app-luma-bottom-sheet
      *transloco="let t"
      titleId="review-decision-title"
      [open]="decision() !== null"
      [title]="decision() ? t('admin.review.confirm.' + decision()) : ''"
      (closed)="closed.emit()"
    >
      <div class="flex flex-col gap-3">
        <p class="m-0 text-body text-fg-muted">
          {{ decision() ? t('admin.review.explain.' + decision()) : '' }}
        </p>
        @if (needsNote()) {
        <label class="text-label-lg text-fg" for="review-note">{{ t('admin.review.note') }}</label>
        <textarea
          id="review-note"
          [placeholder]="t('placeholders.reviewNote')"
          rows="3"
          class="w-full resize-y rounded-md border border-border bg-surface p-3 text-body text-fg focus-visible:outline-2 focus-visible:outline-border-focus"
          [attr.maxlength]="noteMax"
          [attr.aria-invalid]="missingNote() ? 'true' : null"
          [attr.aria-describedby]="missingNote() ? 'review-note-error' : null"
          [value]="note()"
          (input)="onNote($event)"
        ></textarea>
        @if (missingNote()) {
        <p id="review-note-error" class="m-0 text-caption text-danger-fg" role="alert">
          {{ t('admin.errors.noteRequired') }}
        </p>
        } }
        <app-luma-button
          [variant]="decision() === 'approved' ? 'confirm' : decision() === 'suspended' ? 'warning' : 'danger'"
          [fullWidth]="true"
          [disabled]="busy()"
          (clicked)="confirm()"
          >{{ decision() ? t('admin.review.actions.' + decision()) : '' }}</app-luma-button
        >
        <app-luma-button variant="ghost" [fullWidth]="true" (clicked)="closed.emit()"
          >{{ t('admin.review.cancel') }}</app-luma-button
        >
      </div>
    </app-luma-bottom-sheet>
  `,
})
export class ReviewDecisionSheet {
  /** null = closed. */
  public readonly decision = input<ReviewDecision | null>(null);
  public readonly busy = input(false);
  public readonly confirmed = output<{ decision: ReviewDecision; note: string | null }>();
  public readonly closed = output<void>();

  protected readonly note = signal('');
  protected readonly noteMax = NOTE_MAX;
  protected readonly needsNote = computed(
    () => this.decision() !== null && this.decision() !== 'approved',
  );
  protected readonly missingNote = signal(false);

  protected onNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
    this.missingNote.set(false);
  }

  protected confirm(): void {
    const decision = this.decision();
    if (!decision) return;
    const note = this.note().trim();
    if (this.needsNote() && !note) {
      this.missingNote.set(true);
      return;
    }
    this.confirmed.emit({ decision, note: note || null });
    this.note.set('');
  }
}
