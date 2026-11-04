import type { DayMoment } from './recommendation.model';

/** [from, to) in hours of the local clock; `to` past 24 runs into the next day. */
export interface HourWindow {
  readonly from: number;
  readonly to: number;
}

/** What a combo of one moment is made of: menu-section (or product-name) keyword prefixes, accent-insensitive. */
export interface MomentComboConfig {
  /** The moment's time window. */
  readonly hours: HourWindow;
  readonly dish: readonly string[];
  readonly drink: readonly string[];
  /** Optional third item. */
  readonly extra: readonly string[];
}

/** A business counts as near up to this distance (when the location is known). */
export const COMBO_NEAR_KM = 3;
/** Suggestions per moment. */
export const COMBOS_PER_MOMENT = 3;

/**
 * The single configuration of "Combos para {momento}" (Luma IA): the time
 * window and the categories of each moment. Change the keywords here, never
 * in the code (docs/ai.md).
 */
export const MOMENT_COMBOS: Readonly<Record<DayMoment, MomentComboConfig>> = {
  breakfast: {
    hours: { from: 5, to: 10 },
    dish: ['desayun', 'calentado', 'huevo', 'arepa', 'tamal', 'caldo', 'changua'],
    drink: ['cafe', 'tinto', 'chocolate', 'jugo', 'bebida', 'aromatica'],
    extra: ['panad', 'pan', 'fruta', 'almojabana', 'pandebono'],
  },
  midMorning: {
    hours: { from: 10, to: 12 },
    dish: ['empanad', 'panad', 'pasteler', 'reposter', 'arepa', 'sandwich'],
    drink: ['jugo', 'cafe', 'tinto', 'bebida', 'avena'],
    extra: ['fruta', 'postre', 'galleta'],
  },
  lunch: {
    hours: { from: 12, to: 15 },
    dish: ['almuerzo', 'plato', 'fuerte', 'principal', 'bandeja', 'corrientazo', 'ejecutivo', 'hambur', 'pizz'],
    drink: ['jugo', 'limonada', 'bebida', 'gaseosa'],
    extra: ['sopa', 'entrada', 'acompan', 'postre'],
  },
  afternoon: {
    hours: { from: 15, to: 18 },
    dish: ['pasteler', 'reposter', 'postre', 'panad', 'helad', 'empanad', 'torta'],
    drink: ['cafe', 'tinto', 'chocolate', 'jugo', 'malteada', 'bebida'],
    extra: ['galleta', 'fruta'],
  },
  dinner: {
    hours: { from: 18, to: 22 },
    dish: ['plato', 'fuerte', 'principal', 'cena', 'hambur', 'pizz', 'asado', 'pollo'],
    drink: ['jugo', 'limonada', 'bebida', 'gaseosa'],
    extra: ['entrada', 'acompan', 'postre', 'papa'],
  },
  night: {
    hours: { from: 22, to: 29 },
    dish: ['hambur', 'pizz', 'perro', 'salchipapa', 'comida rapida', 'sandwich'],
    drink: ['gaseosa', 'bebida', 'jugo'],
    extra: ['papa', 'acompan', 'postre'],
  },
};
