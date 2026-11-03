import { describe, expect, it } from 'vitest';
import vectors from '../../../../supabase/tests/fixtures/validation_vectors.json';
import { ContactRules } from './contact-rules';
import type { FieldRule } from './field-rule';
import { NumberRules, NumberSpecs } from './number-rules';
import { TextNormalizer } from './text-normalizer';
import { TextRules } from './text-rules';

/** The same vectors run in supabase/tests/round7.sql against the private.* functions. */
const STORED: readonly [keyof typeof vectors, FieldRule][] = [
  ['personName', TextRules.personName],
  ['businessName', TextRules.businessName],
  ['address', TextRules.address],
  ['phone', ContactRules.phone],
  ['mobilePhone', ContactRules.mobilePhone],
  ['instagram', ContactRules.instagram],
  ['website', ContactRules.website],
  ['nit', NumberRules.nit],
  ['freeText300', TextRules.freeText(300)],
];

describe('shared validation vectors (app and database agree)', () => {
  for (const [name, rule] of STORED) {
    it(`${name}: valid and invalid stored values`, () => {
      const set = vectors[name] as { valid: string[]; invalid: string[] };
      expect(set.valid.filter((value) => !rule.spec.isSatisfiedBy(value))).toEqual([]);
      expect(set.invalid.filter((value) => rule.spec.isSatisfiedBy(value))).toEqual([]);
    });
  }

  it('prices and discounts', () => {
    for (const [name, spec] of [['price', NumberSpecs.price], ['discount', NumberSpecs.discount]] as const) {
      expect(vectors[name].valid.every((value) => spec.isSatisfiedBy(value))).toBe(true);
      expect(vectors[name].invalid.some((value) => spec.isSatisfiedBy(value))).toBe(false);
    }
  });

  it('phones typed in any usual way are stored as +57', () => {
    for (const { input, e164 } of vectors.phoneInput) {
      const stored = ContactRules.phone.normalize(input);
      expect(ContactRules.phone.spec.isSatisfiedBy(stored) ? stored : null).toBe(e164);
    }
  });

  it('cleaning: invisible characters out, spaces collapsed, NFC', () => {
    for (const { input, line, lines } of vectors.normalize) {
      expect(TextNormalizer.line(input)).toBe(line);
      expect(TextNormalizer.lines(input)).toBe(lines);
    }
  });
});
