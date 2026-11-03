import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { PasswordChangeService } from '@core/auth/password-change.service';
import { LumaButton, LumaInput, ToastService } from '@design-system';

/**
 * AccountPasswordPage — /account/password: change the password in two
 * steps (current and new password, then the code e-mailed by Supabase's
 * reauthentication). Customers and owners reach it from their account
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
        @if (!codeSent()) {
          <app-luma-input inputId="password-current" type="password" autocomplete="current-password"
            [label]="t('account.password.current')" [required]="true" [value]="current()" (valueChange)="current.set($event)" />
          <app-luma-input inputId="password-next" type="password" autocomplete="new-password"
            [label]="t('account.password.next')" [hint]="t('account.password.rules')" [required]="true"
            [value]="next()" (valueChange)="next.set($event)" />
        } @else {
          <p class="m-0 text-body-sm text-fg-muted" role="status">{{ t('account.password.codeSent') }}</p>
          <app-luma-input inputId="password-code" inputMode="numeric" autocomplete="one-time-code"
            [label]="t('account.password.code')" [required]="true" [value]="code()" (valueChange)="code.set($event)" />
        }
        @if (errorKey(); as key) {
          <p class="m-0 rounded-md bg-danger-bg p-3 text-body-sm text-danger-fg" role="alert">{{ t(key) }}</p>
        }
        <app-luma-button type="submit" size="lg" [fullWidth]="true" [loading]="passwords.busy()">{{
          t(codeSent() ? 'account.password.save' : 'account.password.sendCode')
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
  protected readonly code = signal('');
  protected readonly codeSent = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.passwords.busy()) return;
    this.errorKey.set(null);
    const result = this.codeSent()
      ? await this.passwords.confirm(this.next(), this.code())
      : await this.passwords.requestCode(this.current(), this.next());
    if (!result.success) {
      this.errorKey.set(result.errorKey ?? 'auth.errors.unknown');
      return;
    }
    if (!this.codeSent()) {
      this.codeSent.set(true);
      return;
    }
    this.toast.show({ messageKey: 'account.password.saved', tone: 'success' });
    this.back();
  }

  protected back(): void {
    this.location.back();
  }
}
