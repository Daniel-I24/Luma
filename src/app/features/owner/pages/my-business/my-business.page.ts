import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { type IconName, LumaIcon } from '@design-system';
import { AccountActions } from '@shared/account/account-actions/account-actions';
import { ONBOARDING_PATH } from '@shared/account/onboarding';
import { type OwnerBusinessScreen, ownerPaths } from '@shared/account/owner-paths';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { PanelStateView } from '../../components/panel-state/panel-state';
import { PanelBusinessStore } from '../../state/panel-business.store';
import { EDITABLE_STATUSES } from '../../utils/review-checklist.util';
import { routeBusinessId } from '../../utils/route-business-id';

const SCREENS: readonly { screen: OwnerBusinessScreen; icon: IconName; key: string }[] = [
  { screen: 'info', icon: 'store', key: 'info' },
  { screen: 'hours', icon: 'clock', key: 'hours' },
  { screen: 'verification', icon: 'check', key: 'verification' },
];

/**
 * MyBusinessPage — /owner/:id/business ("Mi negocio"): the business data,
 * hours, legal data and documents, the customer view, the tutorial and the
 * account actions.
 */
@Component({
  selector: 'app-my-business-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaIcon, AccountActions, PanelHeader, PanelStateView],
  providers: [PanelBusinessStore],
  templateUrl: './my-business.page.html',
  host: { class: 'block' },
})
export class MyBusinessPage {
  protected readonly panel = inject(PanelBusinessStore);
  protected readonly id = routeBusinessId();
  protected readonly screens = SCREENS;
  protected readonly tutorialPath = ONBOARDING_PATH;
  /** Legal data and documents can change only while draft or changes requested. */
  protected readonly docsEditable = computed(() => {
    const status = this.panel.business()?.verification_status;
    return !!status && EDITABLE_STATUSES.includes(status);
  });

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.panel.load(id));
    });
  }

  protected screenLink(screen: OwnerBusinessScreen): string[] {
    return ownerPaths.screen(this.id(), screen);
  }
}
