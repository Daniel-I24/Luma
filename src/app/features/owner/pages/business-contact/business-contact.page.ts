import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaInput, ToastService } from '@design-system';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import {
  type ContactErrors,
  type ContactField,
  contactDraft,
  parseContact,
} from '@shared/business/models/business-contact';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { PanelStateView } from '../../components/panel-state/panel-state';
import { PanelBusinessStore } from '../../state/panel-business.store';
import { routeBusinessId } from '../../utils/route-business-id';
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
 * Facebook and website, shown on the public profile. All optional; the
 * business phone stays in the business information.
 */
@Component({
  selector: 'app-business-contact-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SetupReturn,TranslocoModule, LumaButton, LumaInput, PanelHeader, PanelStateView],
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
              [errorMessage]="errors()[spec.field] ? t(errors()[spec.field]!) : undefined"
              [value]="draft()[spec.field]"
              (valueChange)="onInput(spec.field, $event)"
            />
          }
          @if (errorKey(); as key) {
            <p class="m-0 rounded-md bg-danger-bg p-3 text-body-sm text-danger-fg" role="alert">{{ t(key) }}</p>
          }
          <app-luma-button type="submit" size="lg" [fullWidth]="true" [disabled]="saving()">{{
            t(saving() ? 'businessPanel.form.saving' : 'businessPanel.form.save')
          }}</app-luma-button>
        </form>
      </app-panel-state>
    </div>
  `,
  host: { class: 'block' },
})
export class BusinessContactPage {
  protected readonly panel = inject(PanelBusinessStore);
  private readonly repo = inject(OwnedBusinessRepository);
  private readonly toast = inject(ToastService);
  protected readonly id = routeBusinessId();
  protected readonly fields = FIELDS;

  protected readonly draft = signal(contactDraft({}));
  protected readonly errors = signal<ContactErrors>({});
  protected readonly errorKey = signal<string | null>(null);
  protected readonly saving = signal(false);

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.load(id));
    });
  }

  protected async load(id = this.id()): Promise<void> {
    await this.panel.load(id);
    const business = this.panel.business();
    if (business) this.draft.set(contactDraft(business));
  }

  protected onInput(field: ContactField, value: string): void {
    this.draft.update((draft) => ({ ...draft, [field]: value }));
    this.errors.update((errors) => {
      const rest = { ...errors };
      delete rest[field];
      return rest;
    });
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;
    const { value, errors } = parseContact(this.draft());
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
    this.draft.set(contactDraft(value));
    this.toast.show({ messageKey: 'businessPanel.form.saved', tone: 'success' });
  }
}
