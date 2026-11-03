import { type Specification, Spec } from './specification';
import { TextNormalizer } from './text-normalizer';

/**
 * FieldRule — how one kind of field is cleaned, checked and explained: the
 * normalization gives the value to store, the specification decides on
 * that value and the message key says what to fix (validation.* in i18n).
 */
export interface FieldRule {
  readonly messageKey: string;
  /** Native maxlength of the input (characters). */
  readonly maxLength: number;
  /** What is stored for what the user typed (never null: '' when empty). */
  normalize(raw: string): string;
  /** Decides on a normalized value. */
  readonly spec: Specification<string>;
}

/** What a rule needs to be built. */
export interface RuleDefinition {
  readonly messageKey: string;
  readonly maxLength: number;
  readonly spec: Specification<string>;
  readonly normalize?: (raw: string) => string;
  readonly multiline?: boolean;
}

/** FieldRules — builds rules and answers with their message keys. */
export class FieldRules {
  /** A rule; text rules also require the value to be clean (normalized, no invisible characters). */
  public static define(definition: RuleDefinition): FieldRule {
    const normalize = definition.normalize ?? (definition.multiline ? TextNormalizer.lines : TextNormalizer.line);
    return {
      messageKey: definition.messageKey,
      maxLength: definition.maxLength,
      normalize,
      spec: Spec.all(Spec.of((value) => value === normalize(value)), definition.spec),
    };
  }

  /** The message key when the typed value breaks the rule, else null. */
  public static check(rule: FieldRule, raw: string): string | null {
    return rule.spec.isSatisfiedBy(rule.normalize(raw)) ? null : rule.messageKey;
  }

  /** A required field: an empty value gets `requiredKey` instead of the rule message. */
  public static checkRequired(rule: FieldRule, raw: string, requiredKey = 'validation.required'): string | null {
    return rule.normalize(raw) === '' ? requiredKey : FieldRules.check(rule, raw);
  }
}
