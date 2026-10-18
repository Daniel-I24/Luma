import type { SupabaseClient } from '@supabase/supabase-js';
import * as z from 'zod/mini';
import type { MenuItem } from '@shared/business/models/menu.model';
import { sectionRole } from './combo.util';
import type { RecommendationEngine } from './recommendation-engine';
import type {
  Combo,
  ComboRole,
  Recommendation,
  RecommendationReason,
  RecommendationRequest,
  RecommendedBusiness,
} from './recommendation.model';

/** Search radius sent to the function (its maximum). */
export const REMOTE_RADIUS_KM = 10;

/** Reason codes of the function → the app's reasons. */
const REASON_MAP: Readonly<Record<string, RecommendationReason>> = {
  moment_fit: 'moment',
  nearby: 'near',
  top_rated: 'topRated',
  deal: 'promotion',
  variety: 'variety',
};

const answerSchema = z.object({
  businesses: z.array(z.object({ id: z.string(), reason: z.string() })),
  combo: z.nullable(
    z.object({
      business_id: z.string(),
      items: z.array(z.object({ id: z.string(), final_cop: z.number() })),
      total_cop: z.number(),
    }),
  ),
});

/**
 * Luma IA through the recommend Edge Function. Only ids come back; they are
 * matched against the candidates the app already has (unknown ids are
 * dropped). Throws on any failure so the caller falls back to the rules.
 */
export class RemoteRecommendationEngine implements RecommendationEngine {
  constructor(private readonly db: SupabaseClient) {}

  async recommend(request: RecommendationRequest): Promise<Recommendation> {
    if (!request.origin) throw new Error('location_required');
    const { data, error } = await this.db.functions.invoke('recommend', {
      method: 'POST',
      body: {
        moment: request.moment,
        lat: request.origin.lat,
        lng: request.origin.lng,
        radius_km: REMOTE_RADIUS_KM,
      },
    });
    const parsed = answerSchema.safeParse(data);
    if (error || !parsed.success) throw new Error('ai_unavailable');
    const byId = new Map(request.candidates.map((c) => [c.business.id, c]));
    const businesses: RecommendedBusiness[] = parsed.data.businesses.flatMap((pick, index) => {
      const candidate = byId.get(pick.id);
      const reason = REASON_MAP[pick.reason];
      return candidate && reason ? [{ candidate, score: 100 - index, reasons: [reason] }] : [];
    });
    return { businesses, combo: this.toCombo(parsed.data.combo, request) };
  }

  /** The app's combo has one item per role; anything else is shown without a combo. */
  private toCombo(
    combo: z.infer<typeof answerSchema>['combo'],
    request: RecommendationRequest,
  ): Combo | null {
    const candidate = request.candidates.find((c) => c.business.id === combo?.business_id);
    if (!combo || !candidate) return null;
    const picked: Partial<Record<ComboRole, MenuItem>> = {};
    for (const line of combo.items) {
      const item = candidate.menu.find((m) => m.id === line.id);
      const role = item ? sectionRole(item.section) : null;
      if (!item || !role || picked[role]) return null;
      picked[role] = item;
    }
    if (!picked.main || !picked.side || !picked.drink) return null;
    return {
      business: candidate.business,
      items: { main: picked.main, side: picked.side, drink: picked.drink },
      // Server prices (current discounts included); still recalculated at order time.
      totalCop: combo.total_cop,
    };
  }
}

/** Tries the first engine; on any error answers with the second (the rules). */
export class FallbackRecommendationEngine implements RecommendationEngine {
  constructor(
    private readonly primary: RecommendationEngine,
    private readonly fallback: RecommendationEngine,
  ) {}

  async recommend(request: RecommendationRequest): Promise<Recommendation> {
    try {
      return await this.primary.recommend(request);
    } catch {
      return this.fallback.recommend(request);
    }
  }
}
