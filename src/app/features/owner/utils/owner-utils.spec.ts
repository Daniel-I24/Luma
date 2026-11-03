import { describe, expect, it } from 'vitest';
import type { BusinessOrder } from '@shared/orders/business-order.repository';
import { OwnerLocation } from '../owner-shell/owner-shell';
import { ReReview } from './publication-rules';
import { ReviewChecklist } from './review-checklist';
import { BusinessDay } from '@shared/business/domain/opening-hours';
import { TodayStatsCalculator } from './today-stats';

const business = {
  name: 'Mi Fritanga',
  category: 'Restaurante',
  address: 'Calle 18 # 25-30',
  latitude: 1.21,
  longitude: -77.28,
  phone: '3001234567',
};

describe('missingForReview', () => {
  it('mirrors submit_business_for_review, in its order', () => {
    expect(
      ReviewChecklist.missingForReview({
        business: { ...business, phone: null, latitude: 0, longitude: 0 },
        hours: [],
        items: [],
        legal: null,
        docs: [],
      }),
    ).toEqual([
      'location',
      'phone',
      'open_day',
      'available_item',
      'legal',
      'doc_rut',
      'doc_facade',
    ]);
    expect(
      ReviewChecklist.missingForReview({
        business,
        hours: [{ is_closed: false }],
        items: [{ is_available: true }],
        legal: {
          business_id: 'b1',
          tax_id: '800197268-4',
          legal_name: 'X SAS',
          legal_rep_name: 'Ana',
        },
        docs: [{ kind: 'rut' }, { kind: 'facade' }],
      }),
    ).toEqual([]);
  });
});

describe('todayStats', () => {
  const order = (status: BusinessOrder['status'], created_at: string, total_cop = 10_000) =>
    ({ status, created_at, total_cop }) as BusinessOrder;
  // 2026-10-18 21:00 in Bogota (UTC-5) is already 2026-10-19 in UTC.
  const now = new Date('2026-10-19T02:00:00Z');

  it('counts today in Bogota, not in UTC', () => {
    expect(BusinessDay.bogotaDay(now)).toBe('2026-10-18');
    expect(
      TodayStatsCalculator.todayStats(
        [
          order('pending', '2026-10-18T14:00:00Z'),
          order('accepted', '2026-10-18T15:00:00Z'),
          order('preparing', '2026-10-19T01:00:00Z'),
          order('ready', '2026-10-18T16:00:00Z'),
          order('picked_up', '2026-10-18T17:00:00Z', 25_000),
          order('picked_up', '2026-10-18T03:00:00Z', 99_000),
          order('cancelled', '2026-10-18T18:00:00Z'),
        ],
        now,
      ),
    ).toEqual({
      newOrders: 1, preparing: 2, ready: 1, soldCop: 25_000, ordersToday: 5, ordersYesterday: 1, soldYesterdayCop: 99_000,
    });
  });

  it('compares with yesterday for the trend', () => {
    expect(TodayStatsCalculator.trend(5, 1)).toBe('up');
    expect(TodayStatsCalculator.trend(1, 5)).toBe('down');
    expect(TodayStatsCalculator.trend(2, 2)).toBe('same');
  });
});

describe('changesNeedReReview', () => {
  const verified = { ...business, verification_status: 'approved' as const };

  it('warns only for verified businesses whose name, address or location change', () => {
    expect(ReReview.changesNeedReReview(verified, { ...verified, name: 'Otro nombre' })).toBe(true);
    expect(ReReview.changesNeedReReview(verified, { ...verified, longitude: -77.3 })).toBe(true);
    expect(ReReview.changesNeedReReview(verified, verified)).toBe(false);
    expect(
      ReReview.changesNeedReReview(
        { ...verified, verification_status: 'draft' },
        { ...verified, name: 'X' },
      ),
    ).toBe(false);
  });
});

describe('ownerLocation', () => {
  it('reads the business and the tab of Luma Negocios URLs', () => {
    expect(OwnerLocation.ownerLocation('/owner/b1/menu')).toEqual({ id: 'b1', section: 'menu' });
    expect(OwnerLocation.ownerLocation('/owner/b1/business/hours?x=1')).toEqual({
      id: 'b1',
      section: 'business',
    });
    expect(OwnerLocation.ownerLocation('/owner/b1')).toEqual({ id: 'b1', section: 'summary' });
    expect(OwnerLocation.ownerLocation('/owner/new')).toBeNull();
    expect(OwnerLocation.ownerLocation('/owner')).toBeNull();
    expect(OwnerLocation.ownerLocation('/map')).toBeNull();
  });
});
