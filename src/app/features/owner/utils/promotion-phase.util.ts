import type { Promotion } from '@shared/business/models/business.model';

export type PromotionPhase = 'scheduled' | 'running' | 'ended';

/** Where a promotion is in its life; inactive ones count as ended. */
export function promotionPhase(
  promotion: Pick<Promotion, 'is_active' | 'starts_at' | 'ends_at'>,
  now: Date = new Date(),
): PromotionPhase {
  const time = now.getTime();
  if (!promotion.is_active || Date.parse(promotion.ends_at) <= time) return 'ended';
  return Date.parse(promotion.starts_at) > time ? 'scheduled' : 'running';
}

/** "YYYY-MM-DDTHH:MM" in local time, for datetime-local inputs. */
export function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Local datetime-local value to ISO (UTC), or '' when empty or malformed. */
export function fromLocalInput(value: string): string {
  const time = Date.parse(value);
  return value && Number.isFinite(time) ? new Date(time).toISOString() : '';
}
