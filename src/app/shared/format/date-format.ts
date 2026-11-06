/** DateFormat — short dates and times. */
export class DateFormat {
  /** "5 nov 2026, 9:30 p. m.", always in Colombian time: for what stays on record. */
  public static formatColombia(iso: string, lang: string): string {
    return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(iso));
  }

  /** "23 oct." / "Oct 23" in the given language. */
  public static formatShortDate(iso: string, lang: string): string {
    return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(new Date(iso));
  }

  /** "3:45 p. m." / "3:45 PM" in the given language. */
  public static formatTime(iso: string, lang: string): string {
    return new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: '2-digit' }).format(
      new Date(iso),
    );
  }

  /** "23 oct., 3:45 p. m." in the given language. */
  public static formatDateTime(iso: string, lang: string): string {
    return `${DateFormat.formatShortDate(iso, lang)}, ${DateFormat.formatTime(iso, lang)}`;
  }
}

