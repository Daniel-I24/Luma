
const COUNTRY_PREFIX = '+57';
/** Colombian mobiles read as 300 123 4567. */
const GROUP = 3;
/**
 * Phone — a Colombian mobile number (the only kind the app stores), always
 * in E.164 (+573XXXXXXXXX), mirroring public.normalize_co_mobile and the
 * profiles_phone_co_mobile CHECK.
 */
export class Phone {
  private constructor(public readonly e164: string) {}

  /** "+57 300 123 4567", "300 123 4567" or "573001234567"; null when invalid. */
  public static parse(input: string | null | undefined): Phone | null {
    const digits = (input ?? '').replace(/\D/g, '');
    if (/^3\d{9}$/.test(digits)) return new Phone(`+57${digits}`);
    if (/^573\d{9}$/.test(digits)) return new Phone(`+${digits}`);
    return null;
  }

  /** "+57 300 123 4567" */
  public get display(): string {
    const d = this.e164.slice(COUNTRY_PREFIX.length);
    return `${COUNTRY_PREFIX} ${d.slice(0, GROUP)} ${d.slice(GROUP, GROUP + GROUP)} ${d.slice(GROUP + GROUP)}`;
  }

  public equals(other: Phone): boolean {
    return this.e164 === other.e164;
  }
}
