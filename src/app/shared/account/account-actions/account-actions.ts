import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { APP_VERSION } from '@core/config/app-version';
import { LumaButton } from '@design-system';
import { DeleteAccountSheet } from '../delete-account-sheet/delete-account-sheet';


/**
 * AccountActions — change password, help, sign out, delete the account
 * (DeleteAccountSheet: consequences, e-mail code, then delete) and the app version. Shared by the Profile
 * and "Mi negocio" (Luma Negocios).
 */
@Component({
  selector: 'app-account-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaButton, DeleteAccountSheet],
  templateUrl: './account-actions.html',
})
export class AccountActions {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = this.auth.loading;
  protected readonly deleteSheetOpen = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly version = APP_VERSION;

  protected async onSignOut(): Promise<void> {
    this.errorKey.set(null);
    const result = await this.auth.signOut();
    if (result.success) {
      await this.router.navigate(['/auth/login']);
    } else {
      this.errorKey.set('profile.errors.signOut');
    }
  }
}
