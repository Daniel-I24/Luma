import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaIcon } from '@design-system';
import type { BusinessRating } from '@shared/business/models/review.model';

/**
 * ProfileStats — real rating and review count of a business (no invented
 * figures). Shows "Sin reseñas" when there are none and nothing when the
 * ratings could not be loaded.
 */
@Component({
  selector: 'app-profile-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIcon],
  templateUrl: './profile-stats.html',
  host: { class: 'block' },
})
export class ProfileStats {
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly rating = input<BusinessRating | null>(null);
  readonly ratingsLoaded = input(false);

  protected readonly score = computed(() =>
    this.rating()?.rating.toLocaleString(this.lang(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  );
}
