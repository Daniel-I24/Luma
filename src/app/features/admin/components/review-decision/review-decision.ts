import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaBottomSheet, LumaButton } from '@design-system';
import type { ReviewDecision } from '@shared/business/verification/verification.model';

export const NOTE_MAX = 300;

/**
 * ReviewDecision — confirms an admin decision. Rejecting or suspending needs
 * a note for the business (the database requires it too).
 */
@Component({
  selector: 'app-review-decision',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaBottomSheet, LumaButton],
  templateUrl: './review-decision.html',
})
export class ReviewDecisionSheet {
  /** null = closed. */
  readonly decision = input<ReviewDecision | null>(null);
  readonly busy = input(false);
  readonly confirmed = output<{ decision: ReviewDecision; note: string | null }>();
  readonly closed = output<void>();

  protected readonly note = signal('');
  protected readonly noteMax = NOTE_MAX;
  protected readonly needsNote = computed(() => this.decision() !== null && this.decision() !== 'approved');
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
