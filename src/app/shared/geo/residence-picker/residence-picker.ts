import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { FieldRules } from '@core/validation/field-rule';
import { TextRules } from '@core/validation/text-rules';
import { LumaButton, LumaInput, LumaSelect, LumaSkeleton } from '@design-system';
import { Residence } from '../residence';
import { type Municipality, ResidenceCatalog } from '../residence-catalog';

/**
 * ResidencePicker — department, then municipality searched in the bundled
 * DANE catalog, then an optional neighbourhood. Two-way `value`: a complete
 * Residence, or null while something required is missing.
 */
@Component({
  selector: 'app-residence-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaInput, LumaSelect, LumaSkeleton],
  templateUrl: './residence-picker.html',
})
export class ResidencePicker {
  private readonly catalog = inject(ResidenceCatalog);

  public readonly value = model<Residence | null>(null);
  /** Municipality to start from when there is no value yet (a business's city_dane_code). */
  public readonly initialCode = input<string | null>(null);
  public readonly legendKey = input('residence.legend');
  public readonly purposeKey = input('residence.purpose');
  public readonly showNeighborhood = input(true);

  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly departmentCode = signal('');
  protected readonly query = signal('');
  protected readonly municipality = signal<Municipality | null>(null);
  protected readonly neighborhood = signal('');
  protected readonly neighborhoodMax = Residence.NEIGHBORHOOD_MAX;
  protected readonly neighborhoodError = signal<string | null>(null);

  protected readonly departmentOptions = computed(() =>
    this.state() === 'ready' ? this.catalog.departments().map((d) => ({ value: d.code, label: d.name })) : [],
  );
  protected readonly results = computed(() =>
    this.departmentCode() && !this.municipality() ? this.catalog.search(this.departmentCode(), this.query()) : [],
  );

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    const ok = await this.catalog.load();
    this.state.set(ok ? 'ready' : 'error');
    const current = this.value();
    const code = current?.daneCode ?? this.initialCode();
    if (ok && code) {
      this.departmentCode.set(Residence.departmentOf(code));
      this.municipality.set(this.catalog.municipality(code));
      this.neighborhood.set(current?.neighborhood ?? '');
      if (!current) this.emit();
    }
  }

  protected chooseDepartment(code: string): void {
    this.departmentCode.set(code);
    this.municipality.set(null);
    this.query.set('');
    this.emit();
  }

  protected choose(municipality: Municipality): void {
    this.municipality.set(municipality);
    this.emit();
  }

  protected changeMunicipality(): void {
    this.municipality.set(null);
    this.emit();
  }

  protected checkNeighborhood(): void {
    const text = this.neighborhood();
    this.neighborhoodError.set(text.trim() ? FieldRules.check(TextRules.neighborhood, text) : null);
  }

  protected setNeighborhood(text: string): void {
    this.neighborhood.set(text);
    this.neighborhoodError.set(null);
    this.emit();
  }

  private emit(): void {
    const town = this.municipality();
    const department = town ? this.catalog.department(town.departmentCode) : null;
    this.value.set(town && department ? Residence.of(department.name, town.name, town.code, this.neighborhood()) : null);
  }
}
