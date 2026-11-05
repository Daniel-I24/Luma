import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TourHelpButton } from '@shared/tutorial/tour-help-button';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { LumaAvatar, LumaDisclosure, LumaIcon } from '@design-system';
import { DeviceStatus } from '@shared/errors/device-status/device-status';
import { RecentErrors } from '@shared/errors/recent-errors/recent-errors';
import { AccountActions } from '@shared/account/account-actions/account-actions';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { AdminEntry } from '@shared/business/verification/admin-entry/admin-entry';
import { BecomeOwnerEntry } from './components/become-owner-entry/become-owner-entry';
import { HelpEntries } from '@shared/tutorial/help-entries';
import { AppearanceSettings } from '@shared/appearance/appearance-settings/appearance-settings';
import { BusinessEntry } from './components/business-entry/business-entry';
import { NotificationsEntry } from './components/notifications-entry/notifications-entry';
import { NotificationSettings } from '@shared/notifications/notification-settings/notification-settings';
import { DisplayNameField } from './components/display-name-field/display-name-field';
import { TrustStatusCard } from './components/trust-status-card/trust-status-card';

/**
 * ProfilePage — /profile (protected by authGuard)
 * Shows the user, activity, business entry, appearance settings, help and
 * legal links, and the account actions (sign-out, deletion).
 */
@Component({
  selector: 'app-profile-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TourHelpButton,
    TranslocoModule,
    TrustStatusCard,
    LumaAvatar,
    LumaIcon,
    LumaDisclosure,
    DeviceStatus,
    RecentErrors,
    RouterLink,
    AccountActions,
    AdminEntry,
    BecomeOwnerEntry,
    HelpEntries,
    AppearanceSettings,
    BusinessEntry,
    DisplayNameField,
    NotificationsEntry,
    NotificationSettings,
  ],
  templateUrl: './profile.page.html',
})
export class ProfilePage {
  private readonly auth = inject(AuthService);

  protected readonly user = this.auth.user;
  /** The business panel is for business-owner accounts. */
  private readonly sessionProfile = inject(SessionProfileStore);
  protected readonly isBusinessOwner = this.sessionProfile.isBusinessOwner;
  /** The customer offer waits for the account type, so owners never see it flash. */
  protected readonly profileLoaded = computed(() => this.sessionProfile.profile() !== null);
}
