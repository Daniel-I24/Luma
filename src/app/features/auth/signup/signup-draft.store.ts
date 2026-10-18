import { Injectable, computed, signal } from '@angular/core';
import {
  EMPTY_SIGNUP_DRAFT,
  SIGNUP_STEPS,
  STEP_FIELDS,
  type SignupDraft,
  type SignupErrors,
  type SignupField,
} from './signup-draft';
import { validateField, validateStep } from './signup-validation';

/**
 * SignupDraftStore — state of the stepped sign-up. Root-provided so the
 * draft survives a visit to the legal pages and going back; kept in memory
 * only (the password never reaches any storage) and reset after signing up.
 */
@Injectable({ providedIn: 'root' })
export class SignupDraftStore {
  private readonly _draft = signal<SignupDraft>(EMPTY_SIGNUP_DRAFT);
  private readonly _index = signal(0);
  private readonly _errors = signal<SignupErrors>({});

  readonly draft = this._draft.asReadonly();
  readonly errors = this._errors.asReadonly();
  readonly index = this._index.asReadonly();
  readonly step = computed(() => SIGNUP_STEPS[this._index()]);
  readonly total = SIGNUP_STEPS.length;
  readonly isLast = computed(() => this._index() === SIGNUP_STEPS.length - 1);

  /** Sets a field; a field that showed an error is checked again as it changes. */
  update<K extends SignupField>(field: K, value: SignupDraft[K]): void {
    this._draft.update((draft) => ({ ...draft, [field]: value }));
    if (!this._errors()[field]) return;
    const error = validateField(field, this._draft());
    this._errors.update((errors) => {
      const next = { ...errors };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  }

  /** Validates the current step; moves on when valid. Returns the first invalid field. */
  next(): SignupField | null {
    const errors = validateStep(this.step(), this._draft());
    this._errors.set(errors);
    const first = STEP_FIELDS[this.step()].find((field) => errors[field]) ?? null;
    if (!first && !this.isLast()) this._index.update((i) => i + 1);
    return first;
  }

  /** Back one step, keeping everything typed. Returns false on the first step. */
  back(): boolean {
    if (this._index() === 0) return false;
    this._errors.set({});
    this._index.update((i) => i - 1);
    return true;
  }

  reset(): void {
    this._draft.set(EMPTY_SIGNUP_DRAFT);
    this._errors.set({});
    this._index.set(0);
  }
}
