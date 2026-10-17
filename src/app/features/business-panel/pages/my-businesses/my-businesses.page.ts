import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaEmptyState, LumaIcon, LumaSkeleton } from '@design-system';
import { categoryLabelKey } from '@shared/business/data/business-categories';
import {
  OwnedBusinessRepository,
  type OwnedBusinessSummary,
} from '@shared/business/data/owned-business.repository';
import { PanelHeader } from '../../components/panel-header/panel-header';

type ListState = 'loading' | 'ready' | 'error';

/** MyBusinessesPage — /business: the user's businesses and "Registrar mi negocio". */
@Component({
  selector: 'app-my-businesses-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    RouterLink,
    LumaButton,
    LumaEmptyState,
    LumaIcon,
    LumaSkeleton,
    PanelHeader,
  ],
  templateUrl: './my-businesses.page.html',
  host: { class: 'block' },
})
export class MyBusinessesPage {
  private readonly repo = inject(OwnedBusinessRepository);

  protected readonly state = signal<ListState>('loading');
  protected readonly businesses = signal<readonly OwnedBusinessSummary[]>([]);
  protected readonly categoryKey = categoryLabelKey;

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    const result = await this.repo.listMine();
    this.businesses.set(result.data ?? []);
    this.state.set(result.data ? 'ready' : 'error');
  }
}
