import * as z from 'zod/mini';
import type { FieldRule } from './field-rule';

type OptionalText = z.ZodMiniPipe<z.ZodMiniNullable<z.ZodMiniString<string>>, z.ZodMiniTransform<string | null, string | null>>;

/**
 * ZodRules — the same FieldRule inside the zod/mini schemas of the
 * repositories (the last check before the database, which checks again).
 * The value is normalized first, then the rule decides.
 */
export class ZodRules {
  /** A required text field. */
  public static text(rule: FieldRule): z.ZodMiniString<string> {
    return z.string(rule.messageKey).check(
      z.overwrite(rule.normalize),
      z.refine((value) => rule.spec.isSatisfiedBy(value), rule.messageKey),
    );
  }

  /** An optional text field: what cleans down to nothing is stored as null. */
  public static optionalText(rule: FieldRule): OptionalText {
    return z
      .pipe(
        z.nullable(z.string(rule.messageKey)),
        z.transform((value: string | null) => (value === null ? null : rule.normalize(value) || null)),
      )
      .check(z.refine((value) => value === null || rule.spec.isSatisfiedBy(value), rule.messageKey));
  }

  /** The first message (a translation key) of a failed parse, or `fallback` when it has none. */
  public static firstMessage(error: { readonly issues: readonly { readonly message: string }[] }, fallback = 'errors.unexpected'): string {
    return error.issues[0]?.message ?? fallback;
  }
}
