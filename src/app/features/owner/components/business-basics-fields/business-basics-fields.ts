import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ContactRules } from '@core/validation/contact-rules';
import { TextRules } from '@core/validation/text-rules';
import { LumaInput, LumaSelect, type SelectOption } from '@design-system';
import { BUSINESS_CATEGORIES } from '@shared/business/data/business-categories';
import { type FieldErrors, FormErrors } from '@shared/forms/form-errors';
import type { GeoCoords } from '@shared/geo/geolocation.service';
import { ResidenceCatalog } from '@shared/geo/residence-catalog';
import type { Residence } from '@shared/geo/residence';
import { ResidencePicker } from '@shared/geo/residence-picker/residence-picker';
import type { BusinessDraft } from '../../utils/business-draft';
import { LocationPicker } from '../location-picker/location-picker';
import { type AddressProposal, LocationProposal } from '../location-picker/location-proposal';
import { OwnerContextStore } from '../../state/owner-context.store';

/** The text fields checked when the owner leaves them (the same rules as on save and in the database). */
const RULES = {
  name: TextRules.businessName, phone: ContactRules.phone, address: TextRules.address,
  neighborhood: TextRules.neighborhood, reference: TextRules.addressReference,
} as const;

/**
 * BusinessBasicsFields — name, category, phone, department and municipality,
 * the location (LocationPicker: confirm the point), then the address the
 * owner writes, with the optional sector and reference (docs/location.md).
 */
@Component({
  selector: 'app-business-basics-fields',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaInput, LumaSelect, LocationPicker, LocationProposal, ResidencePicker],
  templateUrl: './business-basics-fields.html',
})
export class BusinessBasicsFields {
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  public readonly draft = model.required<BusinessDraft>();
  /** Errors by field; a field loses its error as soon as it is edited. */
  public readonly errors = model<FieldErrors>({});
  /** Prefix of the field ids (focus on the first error). */
  public readonly idPrefix = input.required<string>();
  /** The business being edited (left out of "the same point as another business"). */
  public readonly businessId = input<string | null>(null);

  protected readonly rules = RULES;

  protected readonly categories = computed<SelectOption[]>(() => {
    this.lang();
    return BUSINESS_CATEGORIES.map((c) => ({
      value: c.value,
      label: this.transloco.translate(`businessCategories.${c.key}`),
    }));
  });

  protected set<K extends keyof BusinessDraft>(field: K, value: BusinessDraft[K]): void {
    this.draft.update((draft) => ({ ...draft, [field]: value }));
    const fields = field === 'location' ? ['latitude', 'longitude'] : [field];
    this.errors.update((errors) => FormErrors.withoutErrors(errors, ...fields));
  }

  private readonly catalog = inject(ResidenceCatalog);
  private readonly context = inject(OwnerContextStore);
  /** True once the DANE list is loaded (the residence picker loads it too: one request). */
  private readonly catalogReady = signal(false);
  /** The point confirmed in this visit (the proposal asks only for those). */
  protected readonly confirmed = signal<GeoCoords | null>(null);
  /** DANE centre of the chosen municipality. */
  protected readonly centre = computed<GeoCoords | null>(() => {
    const code = this.draft().municipality?.daneCode ?? this.draft().cityDaneCode;
    const town = this.catalogReady() && code ? this.catalog.municipality(code) : null;
    return town ? { lat: town.latitude, lng: town.longitude } : null;
  });
  protected readonly others = computed<GeoCoords[]>(() =>
    (this.context.businesses() ?? [])
      .filter((b) => b.id !== this.businessId())
      .map((b) => ({ lat: b.latitude, lng: b.longitude })),
  );

  constructor() {
    void this.catalog.load().then((loaded) => this.catalogReady.set(loaded));
  }

  protected setLocation(location: GeoCoords | null): void {
    this.set('location', location);
    this.confirmed.set(location);
  }

  /** "Usar esta dirección": fills both fields, which stay editable. */
  protected useProposal(proposal: AddressProposal): void {
    if (proposal.address) this.set('address', proposal.address);
    if (proposal.neighborhood) this.set('neighborhood', proposal.neighborhood);
  }

  protected setMunicipality(municipality: Residence | null): void {
    this.draft.update((draft) => ({ ...draft, municipality, cityDaneCode: municipality?.daneCode ?? draft.cityDaneCode }));
  }

  protected check(field: keyof typeof RULES): void {
    FormErrors.blur(this.errors, field, RULES[field], this.draft()[field]);
  }

  protected error(field: string): string | undefined {
    const key = this.errors()[field];
    return key ? this.transloco.translate(key) : undefined;
  }
}
