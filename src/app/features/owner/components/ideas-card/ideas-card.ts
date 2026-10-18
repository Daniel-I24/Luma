import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaIcon, LumaSkeleton } from '@design-system';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { PROMOTION_ADVISOR } from '@shared/promotions/advisor/promotion-advisor';
import type { IdeasResult, PromotionIdea } from '@shared/promotions/advisor/promotion-idea';

type IdeasState = 'loading' | 'ready' | 'error';

/**
 * IdeasCard — "Ideas de Luma IA": up to 3 promotion ideas with the reason
 * (translated, with real figures), the final price and "Crear promoción",
 * which only opens the form: the owner reviews and publishes.
 */
@Component({
  selector: 'app-ideas-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaIcon, LumaSkeleton, CopCurrencyPipe],
  templateUrl: './ideas-card.html',
})
export class IdeasCard {
  private readonly advisor = inject(PROMOTION_ADVISOR);

  readonly businessId = input.required<string>();
  readonly create = output<PromotionIdea>();

  protected readonly state = signal<IdeasState>('loading');
  protected readonly result = signal<IdeasResult | null>(null);

  constructor() {
    effect(() => {
      const id = this.businessId();
      untracked(() => void this.load(id));
    });
  }

  protected async load(id = this.businessId()): Promise<void> {
    this.state.set('loading');
    try {
      this.result.set(await this.advisor.suggest(id));
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }
}
