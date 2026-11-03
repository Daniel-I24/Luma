/** TextNormalizer — lower-case, accent-free text for searching. */
export class TextNormalizer {
  /** Lower-cases and strips accents so "cafe" matches "Café". */
  public static normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  }
}

