import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { type IconName, LumaIcon, LumaImage } from '@design-system';
import { ownerPaths } from '@shared/account/owner-paths';
import type { Business, VerificationStatus } from '@shared/business/models/business.model';

const STATUS_CLASS: Readonly<Record<VerificationStatus, string>> = {
  draft: 'bg-canvas-muted text-fg-muted',
  pending: 'bg-info-bg text-info-fg',
  approved: 'bg-success-bg text-success-fg',
  rejected: 'bg-warning-bg text-warning-fg',
  suspended: 'bg-danger-bg text-danger-fg',
};

interface QuickAction {
  readonly key: string;
  readonly icon: IconName;
  readonly link: readonly string[];
}

/**
 * OwnerHero — the top of "Resumen": cover (or the brand gradient), logo,
 * name and verification state, and the quick actions (new product, new
 * promotion, orders, customer view).
 */
@Component({
  selector: 'app-owner-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaIcon, LumaImage],
  templateUrl: './owner-hero.html',
})
export class OwnerHero {
  public readonly business = input.required<Business>();

  protected readonly statusClass = computed(() => STATUS_CLASS[this.business().verification_status]);
  protected readonly actions = computed<readonly QuickAction[]>(() => {
    const id = this.business().id;
    return [
      { key: 'product', icon: 'utensils', link: ownerPaths.section(id, 'menu') },
      { key: 'promotion', icon: 'tag', link: ownerPaths.section(id, 'promotions') },
      { key: 'orders', icon: 'receipt', link: ownerPaths.section(id, 'orders') },
      { key: 'customerView', icon: 'map', link: ['/businesses', id] },
    ];
  });
}
