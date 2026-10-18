import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { LumaAvatar, LumaIcon } from '@design-system';
import { AccountActions } from '@shared/account/account-actions/account-actions';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { AdminEntry } from './components/admin-entry/admin-entry';
import { BecomeOwnerEntry } from './components/become-owner-entry/become-owner-entry';
import { HelpLinks } from './components/help-links/help-links';
import { AppearanceSettings } from './components/appearance-settings/appearance-settings';
import { BusinessEntry } from './components/business-entry/business-entry';
import { NotificationsEntry } from './components/notifications-entry/notifications-entry';
import { DisplayNameField } from './components/display-name-field/display-name-field';

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
    TranslocoModule,
    LumaAvatar,
    LumaIcon,
    RouterLink,
    AccountActions,
    AdminEntry,
    BecomeOwnerEntry,
    HelpLinks,
    AppearanceSettings,
    BusinessEntry,
    DisplayNameField,
    NotificationsEntry,
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
