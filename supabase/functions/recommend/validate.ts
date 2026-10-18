import { promotionPrice } from '../_shared/edge.ts';
import {
  type Candidate,
  MOMENTS,
  type Moment,
  type ModelAnswer,
  REASONS,
  type Reason,
  type Recommendation,
  type RecommendInput,
} from './model.ts';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Body: { moment, lat, lng, radius_km <= 10, at? (ISO, defaults to now) }. */
export function parseInput(body: unknown, now: Date): RecommendInput | null {
  if (!isObject(body)) return null;
  const { moment, lat, lng, radius_km: radius, at } = body;
  if (!MOMENTS.includes(moment as Moment)) return null;
  if (!isNumber(lat) || lat < -90 || lat > 90 || !isNumber(lng) || lng < -180 || lng > 180) return null;
  if (!isNumber(radius) || radius <= 0 || radius > 10) return null;
  const when = at === undefined ? now : typeof at === 'string' ? new Date(at) : null;
  if (!when || Number.isNaN(when.getTime())) return null;
  // Never further than a day away: the moment is "now" or later today.
  if (Math.abs(when.getTime() - now.getTime()) > 86_400_000) return null;
  return { moment: moment as Moment, lat, lng, radiusKm: radius, at: when.toISOString() };
}

/**
 * Strict validator of the model's answer: up to 3 distinct candidate ids with
 * a known reason, and a combo of 1-3 distinct items of one candidate (or null).
 */
export function answerValidator(candidates: readonly Candidate[]) {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  return (value: unknown): ModelAnswer | null => {
    if (!isObject(value) || !Array.isArray(value.businesses) || value.businesses.length > 3) return null;
    const businesses: { id: string; reason: Reason }[] = [];
    for (const entry of value.businesses) {
      if (!isObject(entry) || typeof entry.id !== 'string' || !byId.has(entry.id)) return null;
      if (!REASONS.includes(entry.reason as Reason)) return null;
      if (businesses.some((b) => b.id === entry.id)) return null;
      businesses.push({ id: entry.id, reason: entry.reason as Reason });
    }
    if (value.combo === null || value.combo === undefined) return { businesses, combo: null };
    const combo = value.combo;
    if (!isObject(combo) || typeof combo.business_id !== 'string' || !Array.isArray(combo.item_ids)) return null;
    const owner = byId.get(combo.business_id);
    const ids = combo.item_ids;
    if (!owner || ids.length < 1 || ids.length > 3 || new Set(ids).size !== ids.length) return null;
    if (!ids.every((id) => typeof id === 'string' && owner.items.some((item) => item.id === id))) return null;
    return { businesses, combo: { business_id: owner.id, item_ids: ids as string[] } };
  };
}

/** Prices of the combo from the server data: best current discount per item. */
export function priceRecommendation(answer: ModelAnswer, candidates: readonly Candidate[]): Recommendation {
  if (!answer.combo) return { businesses: answer.businesses, combo: null };
  const owner = candidates.find((c) => c.id === answer.combo?.business_id);
  if (!owner) return { businesses: answer.businesses, combo: null };
  const items = answer.combo.item_ids.flatMap((id) => {
    const item = owner.items.find((i) => i.id === id);
    if (!item) return [];
    const best = owner.promotions
      .filter((p) => p.menu_item_id === id && p.discount_percent !== null)
      .sort((a, b) => (b.discount_percent ?? 0) - (a.discount_percent ?? 0))[0];
    return [{
      id,
      name: item.name,
      list_cop: item.price_cop,
      final_cop: promotionPrice(item.price_cop, best?.discount_percent ?? null),
      promotion_id: best?.id ?? null,
    }];
  });
  const total = items.reduce((sum, line) => sum + line.final_cop, 0);
  return { businesses: answer.businesses, combo: { business_id: owner.id, items, total_cop: total } };
}
