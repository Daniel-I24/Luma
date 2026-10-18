import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton } from '@design-system';
import type { Business } from '@shared/business/models/business.model';
import { PublishStore } from '../../state/publish.store';

/**
 * PublishCard — "Publicado / Pausado" for a verified business: what is still
 * missing before publishing, and the switch. Uses the page's PublishStore.
 */
@Component({
  selector: 'app-publish-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton],
  templateUrl: './publish-card.html',
})
export class PublishCard {
  protected readonly publish = inject(PublishStore);
  readonly business = input.required<Pick<Business, 'is_active'>>();
  readonly toggled = output<boolean>();
}
