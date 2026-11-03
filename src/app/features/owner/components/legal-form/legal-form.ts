import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaInput, ToastService } from '@design-system';
import { Nit } from '@shared/business/domain/nit';
import { DraftNotice } from '@shared/forms/draft-notice/draft-notice';
import { FormDraftStore } from '@shared/forms/form-draft.store';
import { PanelBusinessStore } from '../../state/panel-business.store';
import { VerificationStore } from '../../state/verification.store';
import { MIN_NAME_LENGTH } from '@shared/business/data/business-write.schemas';

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
  protected readonly nitError = signal(false);
  protected readonly textError = signal(false);
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

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.nitError.set(!Nit.parse(this.taxId()));
    this.textError.set(this.legalName().trim().length < MIN_NAME_LENGTH || this.legalRep().trim().length < MIN_NAME_LENGTH);
    if (this.nitError() || this.textError()) return;
    if (await this.store.saveLegal(this.taxId(), this.legalName(), this.legalRep())) {
      this.autosave.saved();
      this.toast.show({ messageKey: 'owner.verificationPage.legalSaved', tone: 'success' });
    }
  }
}
