import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaChip, LumaEmptyState, LumaIcon, LumaSkeleton } from '@design-system';
import { DAY_MOMENTS, type Recommendation } from '@shared/recommendations/recommendation.model';
import { ComboCard } from './components/combo-card/combo-card';
import { RecommendationList } from './components/recommendation-list/recommendation-list';
import { AiStore } from './state/ai.store';

/**
 * AiPage — /ai: "Luma IA" recommendations for a moment of the day (chips,
 * current moment preselected): three businesses and, when possible, a combo
 * that can go straight to the cart.
 */
@Component({
  selector: 'app-ai-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaButton,
    LumaChip,
    LumaEmptyState,
    LumaIcon,
    LumaSkeleton,
    ComboCard,
    RecommendationList,
  ],
  providers: [AiStore],
  templateUrl: './ai.page.html',
  host: { class: 'block' },
})
export class AiPage {
  protected readonly store = inject(AiStore);
  private readonly router = inject(Router);
  protected readonly moments = DAY_MOMENTS;

  constructor() {
    void this.store.load();
  }

  protected openBusiness(id: string): void {
    void this.router.navigate(['/businesses', id]);
  }

  /** One translated sentence for the first pick, from its main reason. */
  protected whyKey(result: Recommendation): string {
    const reason = result.businesses[0]?.reasons[0];
    return reason ? `ai.why.${reason}` : 'ai.why.default';
  }
}
