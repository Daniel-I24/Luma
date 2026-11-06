/*
 * The same steps as private.clean_text in the database
 * (supabase/migrations/20261104000000_round7.sql); the shared vectors in
 * supabase/tests/fixtures/validation_vectors.json keep both in step.
 */
/** Control characters (but tab and line feed), soft hyphen, zero-width, word joiners, BOM and text direction marks. */
// eslint-disable-next-line no-control-regex -- matching control characters is the point: they are removed.
const INVISIBLE = /[\u0000-\u0008\u000E-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/gu;
/** Every space and line separator, line feed included. */
const SPACES = /[\t\n\v\f \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/gu;
/** The same without the line feed (multi-line texts keep their lines). */
const LINE_SPACES = /[\t\v\f \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/gu;
const RETURNS = /\r\n?/g;
const SPACES_AROUND_LINES = / ?\n ?/g;
/** At most one empty line between paragraphs. */
const EXTRA_LINES = /\n{3,}/g;

/**
 * TextNormalizer \u2014 what a text field stores: invisible and control
 * characters removed, spaces collapsed, trimmed and in Unicode NFC. Typing
 * is never blocked; the value is cleaned when it is validated and saved.
 */
export class TextNormalizer {
  /** One line (names, titles, addresses). */
  public static line(raw: string): string {
    return TextNormalizer.base(raw).replace(SPACES, ' ').trim().normalize('NFC');
  }

  /** Several lines (descriptions, comments, notes). */
  public static lines(raw: string): string {
    return TextNormalizer.base(raw)
      .replace(LINE_SPACES, ' ')
      .replace(SPACES_AROUND_LINES, '\n')
      .replace(EXTRA_LINES, '\n\n')
      .trim()
      .normalize('NFC');
  }

  private static base(raw: string): string {
    return raw.replace(RETURNS, '\n').replace(INVISIBLE, '');
  }
}
