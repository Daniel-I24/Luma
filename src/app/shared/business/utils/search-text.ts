/** SearchText — lower-case, accent-free text for searching businesses and menus. */
export class SearchText {
  /** Lower-cases and strips accents so "cafe" matches "Café". */
  public static normalize(value: string): string {
    return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  }
}
