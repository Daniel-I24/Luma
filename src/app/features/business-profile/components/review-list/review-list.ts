import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaAvatar, LumaRatingStars } from '@design-system';
import type { ReviewWithAuthor } from '@shared/business/models/review.model';

/**
 * ReviewList — public reviews: author's display name (or "Usuario Luma"),
 * stars, date and comment. All user text goes through interpolation.
 */
@Component({
  selector: 'app-review-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaAvatar, LumaRatingStars],
  templateUrl: './review-list.html',
  host: { class: 'block' },
})
export class ReviewList {
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly reviews = input.required<readonly ReviewWithAuthor[]>();

  protected date(review: ReviewWithAuthor): string {
    return new Intl.DateTimeFormat(this.lang(), { dateStyle: 'medium' }).format(
      new Date(review.created_at),
    );
  }
}
