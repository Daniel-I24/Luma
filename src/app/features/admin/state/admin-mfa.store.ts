import { Injectable, inject, signal } from '@angular/core';
import { AdminMfaRepository } from '../services/admin-mfa.repository';

/** loading, then enroll (first time) or challenge, then done; error lets the admin retry. */
export type MfaPhase = 'loading' | 'enroll' | 'challenge' | 'done' | 'error';

const CODE = /^[0-9]{6}$/;

/** AdminMfaStore — the TOTP step an admin passes before the review screens. */
@Injectable()
export class AdminMfaStore {
  private readonly repo = inject(AdminMfaRepository);

  private readonly _phase = signal<MfaPhase>('loading');
  private readonly _secret = signal<string | null>(null);
  private readonly _errorKey = signal<string | null>(null);
  private readonly _busy = signal(false);
  private factorId: string | null = null;

  public readonly phase = this._phase.asReadonly();
  /** Shown only while enrolling, for the authenticator app. */
  public readonly secret = this._secret.asReadonly();
  public readonly errorKey = this._errorKey.asReadonly();
  public readonly busy = this._busy.asReadonly();

  public async start(): Promise<void> {
    this._phase.set('loading');
    this._errorKey.set(null);
    const factor = await this.repo.verifiedFactor();
    if (factor.errorKey !== null) return this.fail(factor.errorKey);
    if (factor.data) {
      this.factorId = factor.data;
      this._phase.set('challenge');
      return;
    }
    const enrollment = await this.repo.enroll();
    if (enrollment.errorKey !== null) return this.fail(enrollment.errorKey);
    this.factorId = enrollment.data.factorId;
    this._secret.set(enrollment.data.secret);
    this._phase.set('enroll');
  }

  /** Resolves to true when the code was accepted. */
  public async submit(code: string): Promise<boolean> {
    const clean = code.replace(/\s/g, '');
    if (!CODE.test(clean)) {
      this._errorKey.set('admin.mfa.errors.codeShape');
      return false;
    }
    if (!this.factorId || this._busy()) return false;
    this._busy.set(true);
    try {
      const result = await this.repo.verify(this.factorId, clean);
      this._errorKey.set(result.errorKey);
      if (result.errorKey !== null) return false;
      this._secret.set(null);
      this._phase.set('done');
      return true;
    } finally {
      this._busy.set(false);
    }
  }

  private fail(key: string): void {
    this._errorKey.set(key);
    this._phase.set('error');
  }
}
