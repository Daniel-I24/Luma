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
  template: `
    <ng-container *transloco="let t">
      @if (errorKey()) {
      <p class="m-0 mb-3 rounded-md bg-danger-bg p-3 text-body-sm text-danger-fg" role="alert">
        {{ t(errorKey()!) }}
      </p>
      }
      <nav class="mb-3 flex flex-col gap-2" [attr.aria-label]="t('profile.account')">
        <a
          routerLink="/account/details"
          class="pressable flex min-h-11 items-center rounded-xl border border-border-subtle bg-surface px-4 text-body font-medium text-fg no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          >{{ t('accountDetails.title') }}</a
        >
        <a
          routerLink="/account/password"
          class="pressable flex min-h-11 items-center rounded-xl border border-border-subtle bg-surface px-4 text-body font-medium text-fg no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          >{{ t('account.password.title') }}</a
        >
        <a
          routerLink="/help"
          class="pressable flex min-h-11 items-center rounded-xl border border-border-subtle bg-surface px-4 text-body font-medium text-fg no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          >{{ t('help.title') }}</a
        >
      </nav>
      <app-luma-button
        variant="secondary"
        [fullWidth]="true"
        [disabled]="loading()"
        (clicked)="onSignOut()"
        >{{ t('profile.signOut') }}</app-luma-button
      >
      <div class="mt-8">
        <app-luma-button
          variant="danger"
          size="sm"
          [fullWidth]="true"
          [disabled]="loading()"
          (clicked)="deleteSheetOpen.set(true)"
          >{{ t('profile.deleteAccount') }}</app-luma-button
        >
        <p class="m-0 mt-3 text-center text-caption text-fg-subtle">{{ t('help.version', { version }) }}</p>
      </div>
      <app-delete-account-sheet [open]="deleteSheetOpen()" (closed)="deleteSheetOpen.set(false)" />
    </ng-container>
  `,
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
