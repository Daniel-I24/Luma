import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaBusinessCard } from '@design-system';
import { categoryIcon } from '@shared/business/utils/category-icon.util';
import { DistancePipe } from '@shared/geo/distance.pipe';
import type { RecommendedBusiness } from '@shared/recommendations/recommendation.model';

/** RecommendationList — the recommended businesses, best first, with why. */
@Component({
  selector: 'app-recommendation-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaBusinessCard, DistancePipe],
  templateUrl: './recommendation-list.html',
  host: { class: 'block' },
})
export class RecommendationList {
  private readonly transloco = inject(TranslocoService);
  protected readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  protected readonly icon = categoryIcon;

  readonly picks = input.required<readonly RecommendedBusiness[]>();
  /** Emits the business id to open its profile. */
  readonly open = output<string>();
}
