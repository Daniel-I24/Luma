import { type WritableSignal, computed, signal } from '@angular/core';
import { type FieldRule, FieldRules } from './field-rule';

/**
 * ValidatedField — the state of one form field: what the user types, when
 * its error shows (after leaving the field or on submit, never while
 * typing for the first time) and the value to save. Typing is never
 * blocked; numeric fields filter their characters through the rule.
 */
export class ValidatedField {
  public readonly value: WritableSignal<string>;
  private readonly shown = signal(false);
  private readonly required: boolean;

  /** The message key of the current error, once it may be shown. */
  public readonly error = computed(() => (this.shown() ? this.check() : null));

  constructor(
    public readonly rule: FieldRule,
    options: { readonly required?: boolean; readonly initial?: string; readonly value?: WritableSignal<string> } = {},
  ) {
    this.required = options.required ?? true;
    // A form that already keeps the value in a signal shares it.
    this.value = options.value ?? signal(options.initial ?? '');
  }

  /** The user typed: keep it; once the error is visible it follows the value. */
  public input(raw: string): void {
    this.value.set(raw);
  }

  /** The user left the field: show its error from now on. */
  public blur(): void {
    if (this.value() !== '') this.shown.set(true);
  }

  /** On submit: show the error and tell whether the field is valid. */
  public validate(): boolean {
    this.shown.set(true);
    return this.check() === null;
  }

  /** What is stored ('' when empty). */
  public normalized(): string {
    return this.rule.normalize(this.value());
  }

  /** Puts a stored value back (loading a record); its error stays hidden. */
  public reset(value: string): void {
    this.value.set(value);
    this.shown.set(false);
  }

  private check(): string | null {
    if (this.required) return FieldRules.checkRequired(this.rule, this.value());
    return this.normalized() === '' ? null : FieldRules.check(this.rule, this.value());
  }
}
