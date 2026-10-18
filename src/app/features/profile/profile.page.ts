import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { LumaAvatar, LumaBottomSheet, LumaButton, LumaIcon } from '@design-system';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { AppearanceSettings } from './components/appearance-settings/appearance-settings';
import { BusinessEntry } from './components/business-entry/business-entry';
import { NotificationsEntry } from './components/notifications-entry/notifications-entry';
import { DisplayNameField } from './components/display-name-field/display-name-field';

/**
 * ProfilePage — /profile (protected by authGuard)
 * Shows the user, the appearance settings (theme and language), sign-out and
 * account deletion with confirmation.
 */
@Component({
  selector: 'app-profile-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaAvatar,
    LumaBottomSheet,
    LumaButton,
    LumaIcon,
    RouterLink,
    AppearanceSettings,
    BusinessEntry,
    DisplayNameField,
    NotificationsEntry,
  ],
  templateUrl: './profile.page.html',
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  /** The business panel is for business-owner accounts. */
  protected readonly isBusinessOwner = inject(SessionProfileStore).isBusinessOwner;
  protected readonly loading = this.auth.loading;
  protected readonly deleteSheetOpen = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  /** What account deletion removes, listed in the confirmation sheet. */
  protected readonly deletedData = [
    'account',
    'profile',
    'favorites',
    'reviews',
    'businesses',
  ] as const;

  protected async onSignOut(): Promise<void> {
    this.errorKey.set(null);
    const result = await this.auth.signOut();
    if (result.success) {
      await this.router.navigate(['/auth/login']);
    } else {
      this.errorKey.set('profile.errors.signOut');
    }
  }

  protected async onDeleteAccount(): Promise<void> {
    this.deleteSheetOpen.set(false);
    this.errorKey.set(null);
    const result = await this.auth.deleteAccount();
    if (!result.success) {
      this.errorKey.set(result.errorKey ?? 'auth.errors.deleteAccountFailed');
    }
  }
}
