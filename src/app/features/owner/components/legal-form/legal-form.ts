import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaInput, ToastService } from '@design-system';
import { FieldRules } from '@core/validation/field-rule';
import { NumberRules } from '@core/validation/number-rules';
import { TextRules } from '@core/validation/text-rules';
import { DraftNotice } from '@shared/forms/draft-notice/draft-notice';
import { FormDraftStore } from '@shared/forms/form-draft.store';
import { PanelBusinessStore } from '../../state/panel-business.store';
import { VerificationStore } from '../../state/verification.store';

/** The three fields and their rules (the same as business_legal in the database). */
const RULES = { taxId: NumberRules.nit, legalName: TextRules.legalName, legalRep: TextRules.legalRepName } as const;
type LegalField = keyof typeof RULES;

/** LegalForm — NIT (with check digit), legal name and legal representative; kept as a device draft until saved. */
@Component({
  selector: 'app-legal-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaInput, DraftNotice],
  templateUrl: './legal-form.html',
})
export class LegalForm {
  protected readonly store = inject(VerificationStore);
  private readonly toast = inject(ToastService);

  protected readonly taxId = signal('');
  protected readonly legalName = signal('');
  protected readonly legalRep = signal('');
  private readonly values = { taxId: this.taxId, legalName: this.legalName, legalRep: this.legalRep } as const;
  protected readonly rules = RULES;
  /** Message key per field, shown after leaving it or on save. */
  protected readonly errors = signal<Partial<Record<LegalField, string>>>({});
  private readonly panel = inject(PanelBusinessStore);
  protected readonly autosave = inject(FormDraftStore).attachTo(
    () => ({ taxId: this.taxId(), legalName: this.legalName(), legalRep: this.legalRep() }),
    (value) => {
      this.taxId.set(value.taxId);
      this.legalName.set(value.legalName);
      this.legalRep.set(value.legalRep);
    },
  );

  constructor() {
    effect(() => {
      const businessId = this.panel.business()?.id;
      const legal = this.store.legal();
      if (!businessId) return;
      untracked(() =>
        this.autosave.load(`legal.${businessId}`, {
          taxId: legal?.tax_id ?? '',
          legalName: legal?.legal_name ?? '',
          legalRep: legal?.legal_rep_name ?? '',
        }),
      );
    });
  }

  /** True while the legal data has changes that were not saved. */
  public hasChanges(): boolean {
    return this.autosave.dirty();
  }

  protected edit(field: LegalField, value: string): void {
    this.values[field].set(value);
    this.setError(field, null);
  }

  /** On leaving a field (empty waits for the save) and, required, on save. */
  protected check(field: LegalField, required = false): void {
    const value = this.values[field]();
    if (required || value.trim()) this.setError(field, FieldRules.checkRequired(RULES[field], value));
  }

  private setError(field: LegalField, key: string | null): void {
    this.errors.update((errors) => {
      const next = { ...errors };
      if (key) next[field] = key;
      else delete next[field];
      return next;
    });
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    for (const field of Object.keys(RULES) as LegalField[]) this.check(field, true);
    if (Object.keys(this.errors()).length) return;
    const [taxId, legalName, legalRep] = [RULES.taxId.normalize(this.taxId()), RULES.legalName.normalize(this.legalName()), RULES.legalRep.normalize(this.legalRep())];
    if (await this.store.saveLegal(taxId, legalName, legalRep)) {
      this.autosave.saved();
      this.toast.show({ messageKey: 'owner.verificationPage.legalSaved', tone: 'success' });
    }
  }
}
