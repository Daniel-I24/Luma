import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { LumaButton, LumaCard, LumaBottomSheet } from '@design-system';

/**
 * ProfilePage — /profile (protected by authGuard)
 * Shows user email, sign-out button, and account deletion with confirmation.
 */
@Component({
  selector: 'app-profile-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaCard, LumaBottomSheet],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.css',
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly loading = this.auth.loading;
  protected readonly deleteSheetOpen = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected openDeleteSheet(): void {
    this.deleteSheetOpen.set(true);
  }

  protected closeDeleteSheet(): void {
    this.deleteSheetOpen.set(false);
  }

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
    this.closeDeleteSheet();
    this.errorKey.set(null);
    const result = await this.auth.deleteAccount();
    if (result.success) {
      await this.router.navigate(['/auth/login']);
    } else {
      this.errorKey.set('profile.errors.deleteAccount');
    }
  }
}
