import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { AuthCodeService } from '@core/auth/auth-code.service';
import type { AuthResult } from '@core/auth/auth-error';
import { MS_PER_SECOND } from '@core/config/units';

export type RecoveryStep = 'email' | 'code' | 'password';

/** Seconds before "Reenviar código" works again. */
export const RESEND_WAIT_S = 60;
/** The e-mailed code lasts 10 minutes (docs/auth-emails.md, Email OTP expiration). */
export const CODE_LIFETIME_MS = 600_000;
/** Wrong codes in a row before the flow asks for a new one. */
export const MAX_CODE_ATTEMPTS = 5;

const E = 'auth.forgotPassword.errors';

/**
 * RecoveryFlow — the three steps of /auth/forgot-password: the e-mail, the
 * code (checked with verifyOtp before any new password is asked for) and
 * the new password. Supabase answers the same for a wrong and an expired
 * code, so the time since the code was sent tells them apart.
 */
@Injectable()
export class RecoveryFlow {
  private readonly codes = inject(AuthCodeService);
  private sentAt = 0;
  private attempts = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  private readonly _step = signal<RecoveryStep>('email');
  private readonly _errorKey = signal<string | null>(null);
  private readonly _resendIn = signal(0);
  private readonly _busy = signal(false);
  public readonly step = this._step.asReadonly();
  public readonly errorKey = this._errorKey.asReadonly();
  /** Seconds until the code can be sent again (0: now). */
  public readonly resendIn = this._resendIn.asReadonly();
  public readonly busy = this._busy.asReadonly();
  public readonly email = signal('');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  /** Step 1 → 2: e-mails the code (the same answer whether or not the account exists). */
  public async sendCode(): Promise<boolean> {
    if (this._resendIn() > 0) return false;
    const ok = await this.call(() => this.codes.requestRecoveryCode(this.email()));
    if (!ok) return false;
    this.sentAt = Date.now();
    this.attempts = 0;
    this._step.set('code');
    this.startWait();
    return true;
  }

  /** Step 2 → 3 when the code is right. */
  public async verify(code: string): Promise<boolean> {
    if (this.attempts >= MAX_CODE_ATTEMPTS) {
      this._errorKey.set(`${E}.tooManyAttempts`);
      return false;
    }
    const ok = await this.call(() => this.codes.verifyRecoveryCode(this.email(), code), (key) => this.codeError(key));
    if (ok) this._step.set('password');
    return ok;
  }

  /** Step 3: saves the password (the recovery session is already signed in). */
  public save(password: string): Promise<boolean> {
    return this.call(() => this.codes.setRecoveredPassword(password));
  }

  /** Back to step 1 with another e-mail. */
  public restart(): void {
    this._errorKey.set(null);
    this._step.set('email');
  }

  private codeError(key: string): string {
    if (key === 'auth.errors.tooManyRequests') return `${E}.tooManyAttempts`;
    if (key !== 'auth.errors.codeInvalid') return key;
    this.attempts++;
    if (Date.now() - this.sentAt > CODE_LIFETIME_MS) return `${E}.codeExpired`;
    return this.attempts >= MAX_CODE_ATTEMPTS ? `${E}.tooManyAttempts` : `${E}.codeWrong`;
  }

  private async call(action: () => Promise<AuthResult>, mapError: (key: string) => string = (key) => key): Promise<boolean> {
    if (this._busy()) return false;
    this._busy.set(true);
    this._errorKey.set(null);
    try {
      const result = await action();
      if (!result.success) this._errorKey.set(mapError(result.errorKey ?? 'auth.errors.unknown'));
      return result.success;
    } finally {
      this._busy.set(false);
    }
  }

  private startWait(): void {
    this.stopTimer();
    this._resendIn.set(RESEND_WAIT_S);
    this.timer = setInterval(() => {
      const left = this._resendIn() - 1;
      this._resendIn.set(Math.max(left, 0));
      if (left <= 0) this.stopTimer();
    }, MS_PER_SECOND);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
