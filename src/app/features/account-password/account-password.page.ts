import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { PasswordChangeService } from '@core/auth/password-change.service';
import { LumaButton, LumaInput, ToastService } from '@design-system';

/**
 * AccountPasswordPage — /account/password: change the password, confirming
 * the current one first. Customers and owners reach it from their account
 * section.
 */
@Component({
  selector: 'app-account-password-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaInput],
  template: `
    <main
      *transloco="let t"
      class="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 bg-canvas px-4 pt-[calc(env(safe-area-inset-top)+var(--spacing-6))] pb-6"
    >
      <h1 class="m-0 text-h2 text-fg">{{ t('account.password.title') }}</h1>
      <p class="m-0 text-body-sm text-fg-muted">{{ t('account.password.intro') }}</p>
      <form class="flex flex-col gap-4" novalidate (submit)="save($event)">
        <app-luma-input
          inputId="password-current"
          type="password"
          autocomplete="current-password"
          [label]="t('account.password.current')"
          [required]="true"
          [value]="current()"
          (valueChange)="current.set($event)"
        />
        <app-luma-input
          inputId="password-next"
          type="password"
          autocomplete="new-password"
          [label]="t('account.password.next')"
          [hint]="t('account.password.rules')"
          [required]="true"
          [value]="next()"
          (valueChange)="next.set($event)"
        />
        @if (errorKey(); as key) {
          <p class="m-0 rounded-md bg-danger-bg p-3 text-body-sm text-danger-fg" role="alert">{{ t(key) }}</p>
        }
        <app-luma-button type="submit" size="lg" [fullWidth]="true" [disabled]="passwords.busy()">{{
          t(passwords.busy() ? 'businessPanel.form.saving' : 'account.password.save')
        }}</app-luma-button>
        <app-luma-button variant="ghost" [fullWidth]="true" (clicked)="back()">{{ t('common.back') }}</app-luma-button>
      </form>
    </main>
  `,
})
export class AccountPasswordPage {
  protected readonly passwords = inject(PasswordChangeService);
  private readonly toast = inject(ToastService);
  private readonly location = inject(Location);

  protected readonly current = signal('');
  protected readonly next = signal('');
  protected readonly errorKey = signal<string | null>(null);

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.passwords.busy()) return;
    this.errorKey.set(null);
    const result = await this.passwords.change(this.current(), this.next());
    if (!result.success) {
      this.errorKey.set(result.errorKey ?? 'auth.errors.unknown');
      return;
    }
    this.current.set('');
    this.next.set('');
    this.toast.show({ messageKey: 'account.password.saved', tone: 'success' });
    this.back();
  }

  protected back(): void {
    this.location.back();
  }
}
