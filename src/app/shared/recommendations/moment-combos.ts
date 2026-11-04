import type { BusinessHours } from '@shared/business/models/business.model';
import { OpeningHours } from '@shared/business/domain/opening-hours';
import { ComboBuilder } from './combo-builder';
import { COMBO_NEAR_KM, COMBOS_PER_MOMENT, type HourWindow, MOMENT_COMBOS } from './moment-combos.config';
import type { DayMoment, MomentCombo, RecommendationCandidate } from './recommendation.model';

const HOURS_PER_DAY = 24;
const MS_PER_HOUR = 3_600_000;
/** The window is checked every half hour. */
const STEP_HOURS = 0.5;

/** Is the business open at some point of the moment's window? Given by the caller (it has the hours). */
export type OpenDuring = (candidate: RecommendationCandidate, window: HourWindow) => boolean;

/**
 * MomentCombos — "Combos para {momento}": 2 or 3 combos from open, nearby
 * businesses whose menu has the moment's dish and drink (MOMENT_COMBOS),
 * in the order the recommendation (rules or AI) ranked the businesses, then
 * by distance. Nothing is invented: no products, no combos.
 */
export class MomentCombos {
  /** The combos of `moment`, at most COMBOS_PER_MOMENT, best first. */
  public static forMoment(
    candidates: readonly RecommendationCandidate[],
    moment: DayMoment,
    openDuring: OpenDuring,
    ranking: readonly string[] = [],
  ): MomentCombo[] {
    const config = MOMENT_COMBOS[moment];
    const rank = (c: RecommendationCandidate): number => {
      const at = ranking.indexOf(c.business.id);
      return at === -1 ? ranking.length : at;
    };
    const usable = candidates
      .filter((c) => (c.distanceKm === null || c.distanceKm <= COMBO_NEAR_KM) && openDuring(c, config.hours))
      .sort((a, b) => rank(a) - rank(b) || (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    const combos: MomentCombo[] = [];
    for (const candidate of usable) {
      const combo = ComboBuilder.momentCombo(candidate, config);
      if (combo) combos.push(combo);
      if (combos.length === COMBOS_PER_MOMENT) return combos;
    }
    // A single business: a second combo with its next dish, so there is a choice.
    const only = combos.length === 1 ? usable.find((c) => c.business.id === combos[0]?.business.id) : undefined;
    const second = only && combos[0] ? ComboBuilder.momentCombo(only, config, new Set([combos[0].dish.id])) : null;
    return second ? [...combos, second] : combos;
  }

  /** True when `hour` (0–23) falls in a [from, to) window that may cross midnight (to > 24). */
  public static inWindow(hour: number, { from, to }: HourWindow): boolean {
    return (hour - from + HOURS_PER_DAY) % HOURS_PER_DAY < to - from;
  }

  /**
   * Open at some point of the window's next occurrence (the current one when
   * it is happening now), checked every half hour with the opening-hours rule.
   */
  public static openDuringWindow(rows: readonly BusinessHours[], { from, to }: HourWindow, now = new Date()): boolean {
    const hours = OpeningHours.from(rows);
    const start = new Date(now);
    start.setHours(from, 0, 0, 0);
    // Already over today (and not running through midnight now): tomorrow's.
    if (start.getTime() + (to - from) * MS_PER_HOUR <= now.getTime()) start.setDate(start.getDate() + 1);
    if (MomentCombos.inWindow(now.getHours(), { from, to }) && start > now) start.setDate(start.getDate() - 1);
    for (let h = 0; h < to - from; h += STEP_HOURS) {
      const at = new Date(start.getTime() + h * MS_PER_HOUR);
      if (at.getTime() + STEP_HOURS * MS_PER_HOUR > now.getTime() && hours.isOpenAt(at)) return true;
    }
    return false;
  }
}
