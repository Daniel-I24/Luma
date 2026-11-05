import { inject, signal, type WritableSignal } from '@angular/core';
import type { FieldRule } from '@core/validation/field-rule';
import { FormDraftStore } from './form-draft.store';
import { type FieldErrors, FormErrors } from './form-errors';

/**
 * DraftForm — the state every editing form of the panel shares (composed,
 * not inherited): the draft kept on the device until saved, the errors by
 * field, editing a field (which clears its error) and checking it on blur.
 * Create it in a field initializer (it injects FormDraftStore).
 */
export class DraftForm<D extends object> {
  public readonly draft: WritableSignal<D>;
  public readonly errors = signal<FieldErrors>({});
  public readonly autosave;

  /** `fieldOf` maps a draft field to the field its errors use (`price` → `price_cop`). */
  constructor(initial: D, private readonly fieldOf: Readonly<Record<string, string>> = {}) {
    this.draft = signal(initial);
    this.autosave = inject(FormDraftStore).attach(this.draft);
  }

  /** Loads the stored draft of `formId` (or `fresh`) and clears the errors. */
  public load(formId: string, fresh: D): void {
    this.autosave.load(formId, fresh);
    this.errors.set({});
  }

  /** Edits one field; its error goes away. */
  public set<K extends keyof D>(field: K, value: D[K]): void {
    this.draft.update((draft) => ({ ...draft, [field]: value }));
    const name = String(field);
    this.errors.update((errors) => FormErrors.withoutErrors(errors, this.fieldOf[name] ?? name));
  }

  /** On blur: the rule's message when the typed value breaks it. */
  public check(field: string, rule: FieldRule, raw: string): void {
    FormErrors.blur(this.errors, field, rule, raw);
  }
}
