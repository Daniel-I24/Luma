import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { createFakeSupabase, ok } from '../../../../testing/fake-supabase';
import type { FakeResponse } from '../../../../testing/fake-supabase';
import { BusinessHoursWriteRepository } from './business-hours-write.repository';
import { MenuWriteRepository } from './menu-write.repository';
import { PromotionWriteRepository } from './promotion-write.repository';

function setup(responses: Record<string, FakeResponse> = {}) {
  const fake = createFakeSupabase(responses);
  TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: fake }] });
  return {
    hours: TestBed.inject(BusinessHoursWriteRepository),
    menu: TestBed.inject(MenuWriteRepository),
    promos: TestBed.inject(PromotionWriteRepository),
    queries: fake.queries,
  };
}

const week = Array.from({ length: 7 }, (_, day) => ({
  day_of_week: day,
  opens_at: '18:00',
  closes_at: '02:00',
  is_closed: day === 0,
}));

const item = {
  name: 'Fritanga',
  description: null,
  price_cop: 18000,
  section: 'Platos',
  sort_order: 0,
  is_available: true,
  image_url: null,
};

describe('business panel write repositories', () => {
  it('upserts the whole week, one row per day', async () => {
    const { hours, queries } = setup();

    expect(await hours.saveWeek('b1', week)).toEqual({ data: true, errorKey: null });
    const [rows, options] = queries[0].call('upsert') as [{ business_id: string }[], unknown];
    expect(rows).toHaveLength(7);
    expect(rows.every((row) => row.business_id === 'b1')).toBe(true);
    expect(options).toEqual({ onConflict: 'business_id,day_of_week' });
  });

  it('rejects a week with a repeated day or equal open and close times', async () => {
    const { hours, queries } = setup();

    expect((await hours.saveWeek('b1', [...week.slice(0, 6), week[0]])).errorKey).toBe(
      'businessPanel.errors.invalidData',
    );
    const sameTimes = week.map((d) => (d.day_of_week === 2 ? { ...d, closes_at: '18:00' } : d));
    expect((await hours.saveWeek('b1', sameTimes)).errorKey).toBe(
      'businessPanel.errors.invalidData',
    );
    expect(queries).toHaveLength(0);
  });

  it('creates menu items with whole COP prices only', async () => {
    const { menu, queries } = setup({ menu_items: ok({ id: 'm1' }) });

    expect((await menu.create('b1', item)).data).toEqual({ id: 'm1' });
    expect(queries[0].call('insert')?.[0]).toEqual({ ...item, business_id: 'b1' });
    expect((await menu.create('b1', { ...item, price_cop: 1500.5 })).errorKey).toBe(
      'businessPanel.errors.invalidData',
    );
    expect((await menu.create('b1', { ...item, price_cop: -1 })).errorKey).toBe(
      'businessPanel.errors.invalidData',
    );
  });

  it('deletes and toggles menu items by id', async () => {
    const { menu, queries } = setup();

    await menu.remove('m1');
    await menu.setAvailable('m2', false);

    expect(queries[0].call('delete')).toEqual([]);
    expect(queries[0].call('eq')).toEqual(['id', 'm1']);
    expect(queries[1].call('update')).toEqual([{ is_available: false }]);
  });

  it('requires promotion dates in order', async () => {
    const { promos } = setup();
    const promo = {
      title: '2x1',
      description: null,
      image_url: null,
      starts_at: '2026-10-20T10:00:00-05:00',
      ends_at: '2026-10-19T10:00:00-05:00',
    };

    expect((await promos.create('b1', promo)).errorKey).toBe('businessPanel.errors.invalidData');
  });

  it('ends a running promotion now and a scheduled one without touching its dates', async () => {
    const { promos, queries } = setup();
    const now = new Date('2026-10-14T12:00:00Z');

    await promos.end({ id: 'p1', starts_at: '2026-10-10T00:00:00Z' }, now);
    await promos.end({ id: 'p2', starts_at: '2026-10-20T00:00:00Z' }, now);

    expect(queries[0].call('update')).toEqual([{ is_active: false, ends_at: now.toISOString() }]);
    expect(queries[1].call('update')).toEqual([{ is_active: false }]);
  });
});
