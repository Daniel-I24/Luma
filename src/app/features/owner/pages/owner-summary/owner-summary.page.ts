import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { ToastService } from '@design-system';
import { ownerPaths } from '@shared/account/owner-paths';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { PanelStateView } from '../../components/panel-state/panel-state';
import { PublishCard } from '../../components/publish-card/publish-card';
import { TodayStatsView } from '../../components/today-stats/today-stats';
import { VerificationCard } from '../../components/verification-card/verification-card';
import { BusinessOrdersStore } from '../../state/business-orders.store';
import { OwnerContextStore } from '../../state/owner-context.store';
import { PanelBusinessStore } from '../../state/panel-business.store';
import { PublishStore } from '../../state/publish.store';
import { VerificationStore } from '../../state/verification.store';
import { missingForReview } from '../../utils/review-checklist.util';
import { routeBusinessId } from '../../utils/route-business-id';
import { todayStats } from '../../utils/today-stats.util';

/**
 * OwnerSummaryPage — /owner/:id/summary ("Resumen"): verification state,
 * Publicado / Pausado once verified, and today's orders.
 */
@Component({
  selector: 'app-owner-summary-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    PanelHeader,
    PanelStateView,
    PublishCard,
    TodayStatsView,
    VerificationCard,
  ],
  providers: [PanelBusinessStore, PublishStore, VerificationStore, BusinessOrdersStore],
  templateUrl: './owner-summary.page.html',
  host: { class: 'block' },
})
export class OwnerSummaryPage {
  protected readonly panel = inject(PanelBusinessStore);
  protected readonly publish = inject(PublishStore);
  protected readonly verification = inject(VerificationStore);
  private readonly orders = inject(BusinessOrdersStore);
  private readonly context = inject(OwnerContextStore);
  private readonly toast = inject(ToastService);
  protected readonly id = routeBusinessId();

  protected readonly missing = computed(() => {
    const business = this.panel.business();
    if (!business) return [];
    return missingForReview({
      business,
      hours: this.publish.hours(),
      items: this.publish.items(),
      legal: this.verification.legal(),
      docs: this.verification.docs(),
    });
  });
  protected readonly stats = computed(() => todayStats(this.orders.orders(), new Date()));
  protected readonly ordersLink = computed(() => ownerPaths.section(this.id(), 'orders'));

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.load(id));
    });
  }

  protected async load(id = this.id()): Promise<void> {
    await Promise.all([
      this.panel.load(id),
      this.publish.load(id),
      this.verification.load(id),
      this.orders.load(id),
    ]);
  }

  protected async submitForReview(): Promise<void> {
    if (await this.verification.submit()) {
      this.toast.show({ messageKey: 'owner.verification.submitted', tone: 'success' });
    }
  }

  protected async setPublished(published: boolean): Promise<void> {
    if (!(await this.publish.setPublished(published))) return;
    this.context.patch(this.id(), { is_active: published });
    const key = published ? 'businessPanel.dashboard.publishedToast' : 'owner.publish.pausedToast';
    this.toast.show({ messageKey: key, tone: 'success' });
  }
}
