import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaEmptyState, LumaIcon } from '@design-system';
import type { Promotion } from '@shared/business/models/business.model';

/** PromosTab — active promotions of the business with their end date. */
@Component({
  selector: 'app-promos-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaEmptyState, LumaIcon],
  templateUrl: './promos-tab.html',
  host: { class: 'block' },
})
export class PromosTab {
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly promotions = input.required<readonly Promotion[]>();

  protected endDate(promotion: Promotion): string {
    return new Intl.DateTimeFormat(this.lang(), { dateStyle: 'medium' }).format(
      new Date(promotion.ends_at),
    );
  }
}
