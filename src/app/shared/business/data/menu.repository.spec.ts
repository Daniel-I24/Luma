import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { createFakeSupabase, failure, ok } from '../../../../testing/fake-supabase';
import type { FakeResponse } from '../../../../testing/fake-supabase';
import { MenuRepository } from './menu.repository';

function setup(response: FakeResponse) {
  const fake = createFakeSupabase({ menu_items: response });
  TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: fake }] });
  return { repo: TestBed.inject(MenuRepository), queries: fake.queries };
}

describe('MenuRepository', () => {
  it('reads the menu of one business ordered by section and position', async () => {
    const item = { id: 'm1', name: 'Capuchino', price_cop: 6500 };
    const { repo, queries } = setup(ok([item]));

    const result = await repo.getMenu('b2');

    expect(result).toEqual({ data: [item], errorKey: null });
    expect(queries[0].table).toBe('menu_items');
    expect(queries[0].call('eq')).toEqual(['business_id', 'b2']);
    expect(queries[0].calls.filter(([m]) => m === 'order').map(([, a]) => a[0])).toEqual([
      'section',
      'sort_order',
    ]);
  });

  it('maps Supabase errors to an i18n key', async () => {
    const { repo } = setup(failure('relation does not exist'));

    expect(await repo.getMenu('b2')).toEqual({
      data: null,
      errorKey: 'businesses.errors.menuFailed',
    });
  });

  it('reads the available items of many businesses in one query', async () => {
    const { repo, queries } = setup(ok([{ id: 'm1' }]));

    const result = await repo.getAvailableFor(['b1', 'b2']);

    expect(result).toEqual({ data: [{ id: 'm1' }], errorKey: null });
    expect(queries).toHaveLength(1);
    expect(queries[0].call('in')).toEqual(['business_id', ['b1', 'b2']]);
    expect(queries[0].call('eq')).toEqual(['is_available', true]);
  });

  it('skips the query when there are no businesses', async () => {
    const { repo, queries } = setup(ok([]));

    expect(await repo.getAvailableFor([])).toEqual({ data: [], errorKey: null });
    expect(queries).toHaveLength(0);
  });

  it('re-reads specific items in one query, only if still available', async () => {
    const { repo, queries } = setup(ok([{ id: 'm1' }]));

    expect(await repo.getItemsByIds(['m1', 'm2'])).toEqual({ data: [{ id: 'm1' }], errorKey: null });
    expect(queries[0].call('in')).toEqual(['id', ['m1', 'm2']]);
    expect(queries[0].call('eq')).toEqual(['is_available', true]);
  });
});
