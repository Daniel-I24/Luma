import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaInput, ToastService } from '@design-system';
import { Nit } from '@shared/business/domain/nit';
import { VerificationStore } from '../../state/verification.store';

/** LegalForm — NIT (with check digit), legal name and legal representative. */
@Component({
  selector: 'app-legal-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaInput],
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

  constructor() {
    effect(() => {
      const legal = this.store.legal();
      if (!legal) return;
      this.taxId.set(legal.tax_id);
      this.legalName.set(legal.legal_name);
      this.legalRep.set(legal.legal_rep_name);
    });
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.nitError.set(!Nit.parse(this.taxId()));
    this.textError.set(this.legalName().trim().length < 2 || this.legalRep().trim().length < 2);
    if (this.nitError() || this.textError()) return;
    if (await this.store.saveLegal(this.taxId(), this.legalName(), this.legalRep())) {
      this.toast.show({ messageKey: 'owner.verificationPage.legalSaved', tone: 'success' });
    }
  }
}
