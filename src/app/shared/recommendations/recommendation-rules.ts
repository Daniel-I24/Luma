import type { BusinessStatus } from '@shared/business/models/business.model';
import type { ComboRole, DayMoment } from './recommendation.model';

/**
 * Rules of the v1 recommendation engine (see docs/ai.md). Keywords are
 * accent-insensitive word prefixes matched against free-text categories and
 * menu sections.
 */

/** First hour (0–23) of each moment; a moment lasts until the next one starts. */
export const MOMENT_START_HOUR: Readonly<Record<DayMoment, number>> = {
  breakfast: 5,
  midMorning: 10,
  lunch: 12,
  afternoon: 15,
  dinner: 18,
  night: 22,
};

/** Business categories that suit each moment. */
export const MOMENT_CATEGORIES: Readonly<Record<DayMoment, readonly string[]>> = {
  breakfast: ['cafe', 'cafeteria', 'panad', 'pasteler', 'desayun'],
  midMorning: ['cafe', 'panad', 'pasteler', 'jugo', 'helad'],
  lunch: ['restaur', 'comida', 'cocina', 'asader', 'hambur', 'pizz'],
  afternoon: ['cafe', 'panad', 'pasteler', 'helad', 'jugo'],
  dinner: ['restaur', 'comida', 'cocina', 'pizz', 'hambur', 'asader'],
  night: ['hambur', 'pizz', 'comida', 'tienda', 'bar'],
};

/** Only these statuses can be recommended (open now or opening soon). */
export const RECOMMENDABLE_STATUSES: readonly BusinessStatus[] = [
  'open',
  'closing-soon',
  'opening-soon',
];

/** Score weights (points). */
export const WEIGHTS = {
  momentCategory: 40,
  /** Full points next door, none from MAX_USEFUL_KM on. */
  distance: 25,
  /** Proportional to the average rating out of 5. */
  rating: 20,
  promotion: 10,
  favorite: 15,
  /** Penalty: it is not open yet. */
  openingSoon: -5,
} as const;

export const MAX_USEFUL_KM = 5;
/** Ratings from this value on are labelled "Bien calificado". */
export const TOP_RATING = 4;
/** Distances up to this value are labelled "Cerca". */
export const NEAR_KM = 1;
export const MAX_RECOMMENDATIONS = 3;

/** Menu section keywords → combo role. */
export const SECTION_ROLES: readonly (readonly [string, ComboRole])[] = [
  ['bebida', 'drink'],
  ['jugo', 'drink'],
  ['malteada', 'drink'],
  ['cafe', 'drink'],
  ['entrada', 'side'],
  ['acompan', 'side'],
  ['reposter', 'side'],
  ['postre', 'side'],
  ['plato', 'main'],
  ['fuerte', 'main'],
  ['principal', 'main'],
  ['desayun', 'main'],
  ['almuerzo', 'main'],
  ['bandeja', 'main'],
  ['hambur', 'main'],
  ['pizz', 'main'],
];
