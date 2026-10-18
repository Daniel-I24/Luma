import { describe, expect, it } from 'vitest';
import type { BusinessHours } from '@shared/business/models/business.model';
import { useFixedClock } from '../../../../testing/fixed-clock';
import { fromLocalInput, promotionPhase, toLocalInput } from './promotion-phase.util';
import { missingRequirements } from './publish-requirements.util';
import { crossesMidnight, weekDraft } from './week-draft.util';

const business = { name: 'Fritanga', category: 'Restaurante', latitude: 1.21, longitude: -77.28 };

describe('missingRequirements', () => {
  it('is empty when everything is in place', () => {
    expect(missingRequirements(business, [{ is_closed: false }], [{ is_available: true }])).toEqual(
      [],
    );
  });

  it('lists what is missing, in display order', () => {
    expect(
      missingRequirements(
        { name: ' x ', category: 'Casino', latitude: 0, longitude: 0 },
        [{ is_closed: true }],
        [{ is_available: false }],
      ),
    ).toEqual(['name', 'category', 'location', 'openDay', 'availableItem']);
    expect(missingRequirements(business, [], [])).toEqual(['openDay', 'availableItem']);
  });
});

describe('weekDraft', () => {
  const row = (day: BusinessHours['day_of_week'], closed = false): BusinessHours => ({
    id: `h${day}`,
    business_id: 'b1',
    day_of_week: day,
    opens_at: '18:00:00',
    closes_at: '02:00:00',
    is_closed: closed,
  });

  it('returns 7 days from Monday, closed when there is no row', () => {
    const week = weekDraft([row(1), row(0, true)]);

    expect(week.map((d) => d.day_of_week)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(week[0]).toEqual({
      day_of_week: 1,
      is_closed: false,
      opens_at: '18:00',
      closes_at: '02:00',
    });
    expect(week[1]).toEqual({
      day_of_week: 2,
      is_closed: true,
      opens_at: '08:00',
      closes_at: '18:00',
    });
  });

  it('flags open days that cross midnight', () => {
    const [monday, tuesday] = weekDraft([row(1)]);
    expect(crossesMidnight(monday)).toBe(true);
    expect(crossesMidnight({ ...tuesday, is_closed: false })).toBe(false);
    expect(crossesMidnight({ ...monday, is_closed: true })).toBe(false);
  });
});

describe('promotionPhase', () => {
  useFixedClock('2026-10-14T12:00:00Z');
  const promo = (starts: string, ends: string, active = true) => ({
    is_active: active,
    starts_at: starts,
    ends_at: ends,
  });

  it('classifies scheduled, running and ended promotions', () => {
    expect(promotionPhase(promo('2026-10-15T00:00:00Z', '2026-10-20T00:00:00Z'))).toBe('scheduled');
    expect(promotionPhase(promo('2026-10-10T00:00:00Z', '2026-10-20T00:00:00Z'))).toBe('running');
    expect(promotionPhase(promo('2026-10-01T00:00:00Z', '2026-10-05T00:00:00Z'))).toBe('ended');
    expect(promotionPhase(promo('2026-10-10T00:00:00Z', '2026-10-20T00:00:00Z', false))).toBe(
      'ended',
    );
  });

  it('converts between datetime-local values and ISO', () => {
    const iso = new Date('2026-10-20T10:30:00').toISOString();
    expect(toLocalInput(iso)).toBe('2026-10-20T10:30');
    expect(fromLocalInput('2026-10-20T10:30')).toBe(iso);
    expect(fromLocalInput('')).toBe('');
    expect(fromLocalInput('nope')).toBe('');
  });
});
