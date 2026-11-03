/** Where a customer lives: department and municipality (DANE), optional neighbourhood. */
export class Residence {
  private static readonly DANE_CODE = /^[0-9]{5}$/;
  public static readonly NEIGHBORHOOD_MAX = 60;

  private constructor(
    public readonly department: string,
    public readonly city: string,
    public readonly daneCode: string,
    public readonly neighborhood: string | null,
  ) {}

  /** Two digits of the department (the first two of the municipality code). */
  public get departmentCode(): string {
    return this.daneCode.slice(0, 2);
  }

  /** Null unless the three required values are present and well formed. */
  public static of(
    department: string | null | undefined,
    city: string | null | undefined,
    daneCode: string | null | undefined,
    neighborhood: string | null | undefined = null,
  ): Residence | null {
    const dept = department?.trim() ?? '';
    const town = city?.trim() ?? '';
    if (!dept || !town || !daneCode || !Residence.DANE_CODE.test(daneCode)) return null;
    const area = neighborhood?.trim() ? neighborhood.trim().slice(0, Residence.NEIGHBORHOOD_MAX) : null;
    return new Residence(dept, town, daneCode, area);
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
