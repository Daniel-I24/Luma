import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LumaIcon } from '../icon/luma-icon';

/**
 * LumaRatingStars — compact rating: star, score (0–5) and optional review
 * count. Screen readers get one full sentence instead of the fragments.
 */
@Component({
  selector: 'app-luma-rating-stars',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, LumaIcon],
  templateUrl: './luma-rating-stars.html',
  host: { class: 'inline-flex items-center' },
})
export class LumaRatingStars {
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly rating = input.required<number>();
  readonly reviewCount = input<number | null>(null);
  /** `compact`: one star and the score; `stars`: five stars (e.g. one review). */
  readonly variant = input<'compact' | 'stars'>('compact');

  protected readonly starSlots = [1, 2, 3, 4, 5];
  protected readonly roundedRating = computed(() => Math.round(this.rating()));

  /** Score with one decimal, formatted for the active language. */
  protected readonly score = computed(() =>
    this.rating().toLocaleString(this.lang(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  );
}
