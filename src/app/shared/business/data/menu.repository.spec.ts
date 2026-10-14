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
});
