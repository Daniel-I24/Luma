/**
 * Phone — a Colombian mobile number (the only kind the app stores), always
 * in E.164 (+573XXXXXXXXX), mirroring public.normalize_co_mobile and the
 * profiles_phone_co_mobile CHECK.
 */
export class Phone {
  private constructor(readonly e164: string) {}

  /** "+57 300 123 4567", "300 123 4567" or "573001234567"; null when invalid. */
  static parse(input: string | null | undefined): Phone | null {
    const digits = (input ?? '').replace(/\D/g, '');
    if (/^3\d{9}$/.test(digits)) return new Phone(`+57${digits}`);
    if (/^573\d{9}$/.test(digits)) return new Phone(`+${digits}`);
    return null;
  }

  /** "+57 300 123 4567" */
  get display(): string {
    const d = this.e164.slice(3);
    return `+57 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  }

  equals(other: Phone): boolean {
    return this.e164 === other.e164;
  }
}
