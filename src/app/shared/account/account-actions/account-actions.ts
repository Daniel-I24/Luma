import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { LumaBottomSheet, LumaButton } from '@design-system';

/** What account deletion removes, listed in the confirmation sheet. */
const DELETED_DATA = ['account', 'profile', 'favorites', 'reviews', 'businesses'] as const;

/**
 * AccountActions — sign out, and delete the account after a confirmation
 * sheet. Shared by the Profile and "Mi negocio" (Luma Negocios).
 */
@Component({
  selector: 'app-account-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaBottomSheet, LumaButton],
  templateUrl: './account-actions.html',
})
export class AccountActions {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = this.auth.loading;
  protected readonly deleteSheetOpen = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly deletedData = DELETED_DATA;

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
