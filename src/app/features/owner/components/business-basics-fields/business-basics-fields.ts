import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaInput, LumaSelect, type SelectOption } from '@design-system';
import { BUSINESS_CATEGORIES } from '@shared/business/data/business-categories';
import { type FieldErrors, withoutErrors } from '@shared/forms/form-errors';
import type { GeoCoords } from '@shared/geo/geolocation.service';
import type { BusinessDraft } from '../../utils/business-draft.util';
import { LocationPicker } from '../location-picker/location-picker';

/** BusinessBasicsFields — name, category, phone, address and location of a business. */
@Component({
  selector: 'app-business-basics-fields',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaInput, LumaSelect, LocationPicker],
  templateUrl: './business-basics-fields.html',
})
export class BusinessBasicsFields {
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly draft = model.required<BusinessDraft>();
  /** Errors by field; a field loses its error as soon as it is edited. */
  readonly errors = model<FieldErrors>({});
  /** Prefix of the field ids (focus on the first error). */
  readonly idPrefix = input.required<string>();

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
    this.errors.update((errors) => withoutErrors(errors, ...fields));
  }

  protected setLocation(location: GeoCoords | null): void {
    this.set('location', location);
  }

  protected error(field: string): string | undefined {
    const key = this.errors()[field];
    return key ? this.transloco.translate(key) : undefined;
  }
}
