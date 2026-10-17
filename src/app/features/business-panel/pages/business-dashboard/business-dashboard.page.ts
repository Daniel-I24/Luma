import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { type IconName, LumaButton, LumaIcon, ToastService } from '@design-system';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { PanelStateView } from '../../components/panel-state/panel-state';
import { PanelBusinessStore } from '../../state/panel-business.store';
import { PublishStore } from '../../state/publish.store';
import { routeBusinessId } from '../../utils/route-business-id';

/** Sections of the panel; `path` is relative to /business/:id. */
export const PANEL_SECTIONS: readonly { path: string; icon: IconName; key: string }[] = [
  { path: 'orders', icon: 'receipt', key: 'orders' },
  { path: 'info', icon: 'store', key: 'info' },
  { path: 'hours', icon: 'clock', key: 'hours' },
  { path: 'menu', icon: 'utensils', key: 'menu' },
  { path: 'promotions', icon: 'tag', key: 'promotions' },
];

/** BusinessDashboardPage — /business/:id: publishing status, checklist and sections. */
@Component({
  selector: 'app-business-dashboard-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaButton, LumaIcon, PanelHeader, PanelStateView],
  providers: [PanelBusinessStore, PublishStore],
  templateUrl: './business-dashboard.page.html',
  host: { class: 'block' },
})
export class BusinessDashboardPage {
  protected readonly panel = inject(PanelBusinessStore);
  protected readonly publish = inject(PublishStore);
  private readonly toast = inject(ToastService);
  protected readonly id = routeBusinessId();
  protected readonly sections = PANEL_SECTIONS;

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.load(id));
    });
  }

  protected async load(id = this.id()): Promise<void> {
    await Promise.all([this.panel.load(id), this.publish.load(id)]);
  }

  protected async setPublished(published: boolean): Promise<void> {
    if (await this.publish.setPublished(published)) {
      const key = published ? 'publishedToast' : 'unpublishedToast';
      this.toast.show({ messageKey: `businessPanel.dashboard.${key}`, tone: 'success' });
    }
  }
}
