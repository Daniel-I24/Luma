import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIcon, LumaSkeleton } from '@design-system';
import {
  OwnedBusinessRepository,
  type OwnedBusinessSummary,
} from '@shared/business/data/owned-business.repository';

/**
 * BusinessEntry — Profile link to the business panel: "Mi negocio" when the
 * user owns a business (straight to it when there is only one), otherwise
 * "Registrar mi negocio".
 */
@Component({
  selector: 'app-business-entry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaIcon, LumaSkeleton],
  templateUrl: './business-entry.html',
})
export class BusinessEntry {
  private readonly repo = inject(OwnedBusinessRepository);

  protected readonly loading = signal(true);
  private readonly owned = signal<readonly OwnedBusinessSummary[] | null>(null);

  /** null when loading failed: the list page shows the error and a retry. */
  protected readonly link = computed(() => {
    const owned = this.owned();
    if (owned === null) return { path: ['/business'], key: 'profile.myBusiness' };
    if (owned.length === 0) return { path: ['/business', 'new'], key: 'profile.registerBusiness' };
    return {
      path: owned.length === 1 ? ['/business', owned[0].id] : ['/business'],
      key: 'profile.myBusiness',
    };
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const result = await this.repo.listMine();
    this.owned.set(result.data);
    this.loading.set(false);
  }
}
