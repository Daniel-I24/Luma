import { type FieldRule, FieldRules } from './field-rule';
import { Spec } from './specification';

/*
 * Names and texts. Letters are Unicode letters (\p{L}); digits are decimal
 * digits (\p{Nd}). Postgres checks the same with [[:alpha:]] / [[:digit:]]
 * under the ICU collation "und-x-icu" (docs/validation-matrix.md, "Letras
 * Unicode en Postgres").
 */
const LETTER = /\p{L}/u;
const LETTER_OR_DIGIT = /[\p{L}\p{Nd}]/u;
export const PERSON_NAME_MAX = 60;
const BUSINESS_NAME_MAX = 60;
const ADDRESS_MAX = 120;
/** Lengths of the CHECK constraints of 20261104000000_round7.sql (keep in step). */
const LIMIT = {
  nameMin: 2,
  legalRepMax: 120,
  legalNameMax: 150,
  displayMin: 2,
  displayMax: 40,
  productMax: 80,
  titleMin: 3,
  titleMax: 80,
  sectionMax: 40,
  captionMax: 60,
  neighborhoodMax: 60,
  addressMin: 5,
  searchMax: 80,
} as const;

/** Letters, spaces, apostrophes (' and ’), hyphen and dot; starts with a letter; at least two letters. */
const personName = (max: number, messageKey = 'validation.personName'): FieldRule =>
  FieldRules.define({
    messageKey,
    maxLength: max,
    spec: Spec.all(Spec.length(LIMIT.nameMin, max), Spec.matches(/^\p{L}[\p{L} '’.-]*$/u), Spec.atLeast(LIMIT.nameMin, LETTER)),
  });

/** Letters, digits, spaces and & ' ’ - . , ( ); at least one letter. */
const businessName = (max: number, messageKey = 'validation.businessName'): FieldRule =>
  FieldRules.define({
    messageKey,
    maxLength: max,
    spec: Spec.all(Spec.length(LIMIT.nameMin, max), Spec.matches(/^[\p{L}\p{Nd} &'’.,()-]+$/u), Spec.atLeast(1, LETTER)),
  });

/** One clean line of min..max characters with at least one letter (or digit). */
const line = (messageKey: string, min: number, max: number, needs: RegExp = LETTER): FieldRule =>
  FieldRules.define({ messageKey, maxLength: max, spec: Spec.all(Spec.length(min, max), Spec.atLeast(1, needs)) });

/** Free text of several lines, at most `max` characters (optional fields: ZodRules.optionalText). */
const freeText = (max: number, messageKey = 'validation.freeText'): FieldRule =>
  FieldRules.define({ messageKey, maxLength: max, multiline: true, spec: Spec.length(1, max) });

/** TextRules — the rules of names, titles, addresses and free texts. */
export const TextRules = {
  personName: personName(PERSON_NAME_MAX),
  /** Legal representative: a person, with the length of business_legal.legal_rep_name. */
  legalRepName: personName(LIMIT.legalRepMax, 'validation.legalRepName'),
  businessName: businessName(BUSINESS_NAME_MAX),
  /** Razón social: the characters of a business name, up to 150. */
  legalName: businessName(LIMIT.legalNameMax, 'validation.legalName'),
  /** Public name on reviews (profiles.display_name). */
  displayName: line('validation.displayName', LIMIT.displayMin, LIMIT.displayMax),
  productName: line('validation.productName', 1, LIMIT.productMax, LETTER_OR_DIGIT),
  promotionTitle: line('validation.promotionTitle', LIMIT.titleMin, LIMIT.titleMax),
  menuSection: line('validation.shortText', 1, LIMIT.sectionMax, LETTER_OR_DIGIT),
  photoCaption: line('validation.shortText', 1, LIMIT.captionMax, LETTER_OR_DIGIT),
  neighborhood: line('validation.shortText', 1, LIMIT.neighborhoodMax, LETTER_OR_DIGIT),
  /** 5 to 120 characters with letters and a number ("Calle 18 # 25-30"). */
  address: FieldRules.define({
    messageKey: 'validation.address',
    maxLength: ADDRESS_MAX,
    spec: Spec.all(
      Spec.length(LIMIT.addressMin, ADDRESS_MAX),
      Spec.matches(/^[\p{L}\p{Nd} #.,/°º()'’-]+$/u),
      Spec.atLeast(1, LETTER),
      Spec.atLeast(1, /\p{Nd}/u),
    ),
  }),
  /** Searches: one clean line, never stored. */
  search: FieldRules.define({ messageKey: 'validation.search', maxLength: LIMIT.searchMax, spec: Spec.length(0, LIMIT.searchMax) }),
  freeText,
} as const;
