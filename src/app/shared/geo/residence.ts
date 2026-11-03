/** Where a customer lives: department and municipality (DANE), optional neighbourhood. */
export class Residence {
  private static readonly DANE_CODE = /^[0-9]{5}$/;
  /** The department is the first two digits of a DANE municipality code. */
  private static readonly DEPARTMENT_DIGITS = 2;
  public static readonly NEIGHBORHOOD_MAX = 60;

  private constructor(
    public readonly department: string,
    public readonly city: string,
    public readonly daneCode: string,
    public readonly neighborhood: string | null,
  ) {}

  /** Two digits of the department (the first two of the municipality code). */
  public get departmentCode(): string {
    return Residence.departmentOf(this.daneCode);
  }

  /** Department code of a DANE municipality code ("52001" → "52"). */
  public static departmentOf(daneCode: string): string {
    return daneCode.slice(0, Residence.DEPARTMENT_DIGITS);
  }

  /** Null unless the three required values are present and well formed. */
  public static of(
    department: string | null | undefined,
    city: string | null | undefined,
    daneCode: string | null | undefined,
    neighborhood: string | null | undefined = null,
  ): Residence | null {
    const dept = Residence.clean(department);
    const town = Residence.clean(city);
    if (!dept || !town || !Residence.DANE_CODE.test(daneCode ?? '')) return null;
    const area = Residence.clean(neighborhood)?.slice(0, Residence.NEIGHBORHOOD_MAX) ?? null;
    return new Residence(dept, town, daneCode as string, area);
  }

  /** Trimmed text, or null when empty. */
  private static clean(value: string | null | undefined): string | null {
    return value?.trim() || null;
  }

  /** The profile columns (public.profiles.residence_*). */
  public toRow(): Record<string, string | null> {
    return {
      residence_department: this.department,
      residence_city: this.city,
      residence_dane_code: this.daneCode,
      residence_neighborhood: this.neighborhood,
    };
  }
}
