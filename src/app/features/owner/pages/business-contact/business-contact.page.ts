import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaInput, ToastService } from '@design-system';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import { FieldRules } from '@core/validation/field-rule';
import { CONTACT_RULES, type ContactErrors, type ContactField, BusinessContacts } from '@shared/business/models/business-contact';
import { ContactVerificationCard } from '../../components/contact-verification/contact-verification';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { PanelStateView } from '../../components/panel-state/panel-state';
import { PanelBusinessStore } from '../../state/panel-business.store';
import { RouteBusinessId } from '../../utils/route-business-id';
import { SetupReturn } from '../../components/setup-return/setup-return';

interface FieldSpec {
  readonly field: ContactField;
  readonly type: 'text' | 'tel' | 'url';
  readonly inputMode: string;
  readonly autocomplete: string | null;
}

const FIELDS: readonly FieldSpec[] = [
  { field: 'whatsapp', type: 'tel', inputMode: 'tel', autocomplete: 'tel-national' },
  { field: 'instagram', type: 'text', inputMode: 'text', autocomplete: null },
  { field: 'facebook', type: 'text', inputMode: 'text', autocomplete: null },
  { field: 'website', type: 'url', inputMode: 'url', autocomplete: 'url' },
];

/**
 * BusinessContactPage — /owner/:id/business/contact: WhatsApp, Instagram,
 * Facebook and website, all optional; the business phone stays in the
 * business information. Customers see a contact only once the review team
 * verified it (ContactVerificationCard: code and steps per contact).
 */
@Component({
  selector: 'app-business-contact-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SetupReturn, TranslocoModule, LumaButton, LumaInput, PanelHeader, PanelStateView, ContactVerificationCard],
  providers: [PanelBusinessStore],
  template: `
    <div
      *transloco="let t"
      class="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-[calc(env(safe-area-inset-top)+var(--spacing-6))] pb-6"
    >
      <app-panel-header [heading]="t('businessPanel.contact.title')" [backLink]="['/owner', id(), 'business']" />
      <app-setup-return />
      <app-panel-state [state]="panel.state()" (retry)="load()">
        <p class="m-0 text-body-sm text-fg-muted">{{ t('businessPanel.contact.intro') }}</p>
        <form class="mt-4 flex flex-col gap-5" novalidate (submit)="save($event)">
          @for (spec of fields; track spec.field) {
            <app-luma-input
              [inputId]="'contact-' + spec.field"
              [type]="spec.type"
              [inputMode]="spec.inputMode"
              [autocomplete]="spec.autocomplete"
              [label]="t('businessPanel.contact.' + spec.field)"
              [placeholder]="t('businessPanel.contact.' + spec.field + 'Placeholder')"
              [maxLength]="rules[spec.field].maxLength"
              [errorMessage]="errors()[spec.field] ? t(errors()[spec.field]!) : undefined"
              [value]="draft()[spec.field]"
              (valueChange)="onInput(spec.field, $event)"
              (blurred)="check(spec.field)"
            />
          }
          @if (errorKey(); as key) {
            <p class="m-0 rounded-md bg-danger-bg p-3 text-body-sm text-danger-fg" role="alert">{{ t(key) }}</p>
          }
          <app-luma-button type="submit" size="lg" [fullWidth]="true" [disabled]="saving()">{{
            t(saving() ? 'businessPanel.form.saving' : 'businessPanel.form.save')
          }}</app-luma-button>
        </form>
        @if (panel.business(); as business) {
          <app-contact-verification class="mt-6 block" [business]="business" />
        }
      </app-panel-state>
    </div>
  `,
  host: { class: 'block' },
})
export class BusinessContactPage {
  protected readonly panel = inject(PanelBusinessStore);
  private readonly repo = inject(OwnedBusinessRepository);
  private readonly toast = inject(ToastService);
  protected readonly id = RouteBusinessId.routeBusinessId((id) => this.load(id));
  protected readonly fields = FIELDS;
  protected readonly rules = CONTACT_RULES;

  protected readonly draft = signal(BusinessContacts.contactDraft({}));
  protected readonly errors = signal<ContactErrors>({});
  protected readonly errorKey = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected async load(id = this.id()): Promise<void> {
    await this.panel.load(id);
    const business = this.panel.business();
    if (business) this.draft.set(BusinessContacts.contactDraft(business));
  }

  protected onInput(field: ContactField, value: string): void {
    this.draft.update((draft) => ({ ...draft, [field]: value }));
    this.errors.update((errors) => {
      const rest = { ...errors };
      delete rest[field];
      return rest;
    });
  }

  /** Leaving a field shows its error at once. */
  protected check(field: ContactField): void {
    const raw = this.draft()[field];
    const key = raw.trim() ? FieldRules.check(CONTACT_RULES[field], raw) : null;
    if (key) this.errors.update((errors) => ({ ...errors, [field]: key }));
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;
    const { value, errors } = BusinessContacts.parseContact(this.draft());
    this.errors.set(errors);
    if (Object.keys(errors).length > 0) {
      this.errorKey.set('businessPanel.form.fixErrors');
      return;
    }
    this.errorKey.set(null);
    this.saving.set(true);
    const result = await this.repo.updateContact(this.id(), value);
    this.saving.set(false);
    if (result.errorKey) {
      this.errorKey.set(result.errorKey);
      return;
    }
    this.panel.patch(value);
    this.draft.set(BusinessContacts.contactDraft(value));
    this.toast.show({ messageKey: 'businessPanel.form.saved', tone: 'success' });
  }
}
