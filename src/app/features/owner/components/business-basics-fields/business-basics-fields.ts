import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ContactRules } from '@core/validation/contact-rules';
import { TextRules } from '@core/validation/text-rules';
import { LumaInput, LumaNotice, LumaSelect, type SelectOption } from '@design-system';
import { BUSINESS_CATEGORIES } from '@shared/business/data/business-categories';
import { type FieldErrors, FormErrors } from '@shared/forms/form-errors';
import { type GeoCoords, PASTO_CENTRE } from '@shared/geo/geolocation.service';
import { Haversine } from '@shared/geo/distance';
import type { Place } from '@shared/geo/place-search.repository';
import type { Residence } from '@shared/geo/residence';
import { ResidencePicker } from '@shared/geo/residence-picker/residence-picker';
import { AddressSearch } from '../address-search/address-search';
import type { BusinessDraft } from '../../utils/business-draft';
import { LocationPicker } from '../location-picker/location-picker';

/** A pin this far from the searched address deserves a second look. */
const FAR_FROM_ADDRESS_KM = 0.3;
/** The text fields checked when the owner leaves them (the same rules as on save and in the database). */
const RULES = { name: TextRules.businessName, phone: ContactRules.phone, address: TextRules.address } as const;

/**
 * BusinessBasicsFields — name, category, phone, address, department and
 * municipality, and the location: search the address, then drag the pin.
 */
@Component({
  selector: 'app-business-basics-fields',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaNotice, TranslocoModule, LumaInput, LumaSelect, LocationPicker, AddressSearch, ResidencePicker],
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

  /** Where the address search put the pin; null until the owner searches. */
  protected readonly searched = signal<GeoCoords | null>(null);
  protected readonly near = computed(() => this.draft().location ?? PASTO_CENTRE);
  /** The pin was dragged far from the address that was searched. */
  protected readonly farFromAddress = computed(() => {
    const from = this.searched();
    const to = this.draft().location;
    return !!from && !!to && Haversine.haversineKm(from.lat, from.lng, to.lat, to.lng) > FAR_FROM_ADDRESS_KM;
  });

  protected setLocation(location: GeoCoords | null): void {
    this.set('location', location);
  }

  protected onAddress(place: Place): void {
    const point = { lat: place.lat, lng: place.lng };
    this.searched.set(point);
    this.setLocation(point);
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
