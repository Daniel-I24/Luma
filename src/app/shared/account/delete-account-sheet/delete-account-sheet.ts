import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { AuthRules } from '@core/validation/auth-rules';
import { ValidatedField } from '@core/validation/validated-field';
import { TranslocoModule } from '@jsverse/transloco';
import { AccountReauthService } from '@core/auth/account-reauth.service';
import { AuthService } from '@core/auth/auth.service';
import { LumaBottomSheet, LumaButton, LumaInput, LumaNotice } from '@design-system';

/** What account deletion removes, listed before anything is sent. */
const DELETED_DATA = ['account', 'profile', 'favorites', 'reviews', 'businesses'] as const;
const CODE_LENGTH = 6;

type Step = 'consequences' | 'code';

/**
 * DeleteAccountSheet — deleting an account takes deliberate steps: read the
 * consequences, receive a 6-digit code at the account's e-mail
 * (signInWithOtp, never creating users), type it (verifyOtp starts a fresh
 * session) and only then delete-account runs. Each failure has its own message.
 */
@Component({
  selector: 'app-delete-account-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaNotice, TranslocoModule, LumaBottomSheet, LumaButton, LumaInput],
  templateUrl: './delete-account-sheet.html',
})
export class DeleteAccountSheet {
  private readonly auth = inject(AuthService);
  private readonly reauth = inject(AccountReauthService);

  public readonly open = input.required<boolean>();
  public readonly closed = output<void>();

  protected readonly deletedData = DELETED_DATA;
  protected readonly codeLength = CODE_LENGTH;
  protected readonly step = signal<Step>('consequences');
  protected readonly code = signal('');
  protected readonly codeField = new ValidatedField(AuthRules.code, { value: this.code });
  protected readonly busy = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly email = computed(() => this.auth.user()?.email ?? '');
  protected readonly codeReady = computed(() => this.code().trim().length === CODE_LENGTH);

  /** Consequences read → e-mails the code. */
  protected async sendCode(): Promise<void> {
    await this.run(async () => {
      const sent = await this.reauth.sendCode(this.email());
      if (!sent.success) return sent.errorKey ?? 'auth.errors.unknown';
      this.step.set('code');
      return null;
    });
  }

  /** Checks the code, then deletes (AuthService signs out and leaves on success). */
  protected async confirm(): Promise<void> {
    await this.run(async () => {
      const verified = await this.reauth.verifyCode(this.email(), this.code().trim());
      if (!verified.success) return verified.errorKey ?? 'auth.errors.codeInvalid';
      const deleted = await this.auth.deleteAccount();
      return deleted.success ? null : (deleted.errorKey ?? 'auth.errors.deleteAccountFailed');
    });
  }

  protected close(): void {
    this.step.set('consequences');
    this.code.set('');
    this.errorKey.set(null);
    this.closed.emit();
  }

  private async run(action: () => Promise<string | null>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.errorKey.set(null);
    try {
      this.errorKey.set(await action());
    } finally {
      this.busy.set(false);
    }
  }
}
