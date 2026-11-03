import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { ConnectivityService } from '@core/network/connectivity.service';
import { LumaButton, LumaEmptyState } from '@design-system';
import { SessionProfileStore } from '@shared/account/session-profile.store';

/**
 * AccountErrorPage — /account-error. The profile (and so the account type)
 * could not be read: offer to retry or sign out, never show the screens of
 * a guessed account type.
 */
@Component({
  selector: 'app-account-error-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaEmptyState],
  template: `
    <main
      *transloco="let t"
      class="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 bg-canvas px-4"
    >
      <app-luma-empty-state
        icon="alert"
        [heading]="t('accountError.title')"
        [description]="t(descriptionKey())"
      >
        <div class="flex flex-col gap-2">
          <app-luma-button [disabled]="busy()" (clicked)="retry()">{{
            t('accountError.retry')
          }}</app-luma-button>
          @if (stillFailing()) {
            <p class="text-caption text-danger-fg" role="alert">{{ t('accountError.stillFailing') }}</p>
          }
          <app-luma-button variant="ghost" [disabled]="busy()" (clicked)="signOut()">{{
            t('accountError.signOut')
          }}</app-luma-button>
        </div>
      </app-luma-empty-state>
    </main>
  `,
})
export class AccountErrorPage {
  private readonly store = inject(SessionProfileStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly online = inject(ConnectivityService).online;

  protected readonly busy = signal(false);
  protected readonly stillFailing = signal(false);
  protected readonly descriptionKey = computed(() =>
    this.online() ? 'accountError.description' : 'errors.offline',
  );

  protected async retry(): Promise<void> {
    this.busy.set(true);
    this.stillFailing.set(false);
    try {
      if (await this.store.retry()) {
        await this.router.navigateByUrl(await this.store.landingPath());
      } else {
        this.stillFailing.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    this.busy.set(true);
    try {
      await this.auth.signOut();
      await this.router.navigate(['/auth/login']);
    } finally {
      this.busy.set(false);
    }
  }
}
