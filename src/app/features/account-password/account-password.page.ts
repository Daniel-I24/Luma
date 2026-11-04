import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { AuthRules } from '@core/validation/auth-rules';
import { PasswordRules } from '@core/validation/password-rules';
import { ValidatedField } from '@core/validation/validated-field';
import { TranslocoModule } from '@jsverse/transloco';
import { PasswordChangeService } from '@core/auth/password-change.service';
import { LumaButton, LumaInput, LumaNotice, ToastService } from '@design-system';
import { PasswordChecklist } from '@shared/account/password-checklist/password-checklist';

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
  imports: [LumaNotice, TranslocoModule, LumaButton, LumaInput, PasswordChecklist],
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
            [label]="t('account.password.current')" [required]="true" [value]="current()" (valueChange)="current.set($event)"
            (blurred)="fields.current.blur()" [errorMessage]="fields.current.error() ? t(fields.current.error()!) : undefined" />
          <app-luma-input inputId="password-next" type="password" autocomplete="new-password"
            [label]="t('account.password.next')" [hint]="t('account.password.rules')" [required]="true"
            [value]="next()" (valueChange)="next.set($event)"
            (blurred)="touched.set(true)" [errorMessage]="touched() && nextError() ? t(nextError()!) : undefined" />
          <app-password-checklist checklistId="password-next-checklist" [password]="next()" [email]="email()" />
          <app-luma-input inputId="password-confirm" type="password" autocomplete="new-password"
            [label]="t('auth.password.confirm')" [placeholder]="t('auth.password.confirmPlaceholder')" [required]="true" [value]="confirmation()" (valueChange)="confirmation.set($event)"
            (blurred)="touched.set(true)" [errorMessage]="touched() && mismatch() ? t('auth.password.mismatch') : undefined" />
        } @else {
          <p class="m-0 text-body-sm text-fg-muted" role="status">{{ t('account.password.codeSent') }}</p>
          <app-luma-input inputId="password-code" inputMode="numeric" autocomplete="one-time-code" [digitsOnly]="true"
            [placeholder]="t('placeholders.code')" [maxLength]="fields.code.rule.maxLength"
            [label]="t('account.password.code')" [required]="true" [value]="code()" (valueChange)="code.set($event)"
            (blurred)="fields.code.blur()" [errorMessage]="fields.code.error() ? t(fields.code.error()!) : undefined" />
        }
        @if (errorKey(); as key) {
          <app-luma-notice tone="danger">{{ t(key) }}</app-luma-notice>
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
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly location = inject(Location);

  protected readonly current = signal('');
  protected readonly next = signal('');
  protected readonly confirmation = signal('');
  protected readonly touched = signal(false);
  protected readonly email = computed(() => this.auth.user()?.email ?? '');
  protected readonly nextError = computed(() => PasswordRules.errorKey(this.next(), this.email()));
  protected readonly mismatch = computed(() => this.confirmation() !== this.next());
  protected readonly code = signal('');
  protected readonly codeSent = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly fields = {
    current: new ValidatedField(AuthRules.currentPassword, { value: this.current }),
    code: new ValidatedField(AuthRules.code, { value: this.code }),
  } as const;

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.passwords.busy()) return;
    if (!this.validStep()) return;
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

  /** Validates the fields of the current step (the new password: PasswordRules and the repetition). */
  private validStep(): boolean {
    this.touched.set(true);
    if (this.codeSent()) return this.fields.code.validate();
    const current = this.fields.current.validate();
    return current && !this.nextError() && !this.mismatch();
  }

  protected back(): void {
    this.location.back();
  }
}
