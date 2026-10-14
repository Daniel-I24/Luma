import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { createFakeSupabase, failure, ok } from '../../../../testing/fake-supabase';
import type { FakeResponse } from '../../../../testing/fake-supabase';
import { FavoriteRepository } from './favorite.repository';

function setup(response: FakeResponse) {
  const fake = createFakeSupabase({ favorites: response });
  TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: fake }] });
  return { repo: TestBed.inject(FavoriteRepository), queries: fake.queries };
}

describe('FavoriteRepository', () => {
  it('lists the ids of the saved businesses, newest first', async () => {
    const { repo, queries } = setup(ok([{ business_id: 'b4' }, { business_id: 'b1' }]));

    expect(await repo.getFavoriteIds()).toEqual({ data: ['b4', 'b1'], errorKey: null });
    expect(queries[0].call('select')).toEqual(['business_id']);
    expect(queries[0].call('order')).toEqual(['created_at', { ascending: false }]);
  });

  it('adds a favourite without sending a user id (the database sets it)', async () => {
    const { repo, queries } = setup(ok(null));

    expect(await repo.add('b4')).toEqual({ data: true, errorKey: null });
    expect(queries[0].call('insert')).toEqual([{ business_id: 'b4' }]);
  });

  it('removes a favourite by business', async () => {
    const { repo, queries } = setup(ok(null));

    expect(await repo.remove('b4')).toEqual({ data: true, errorKey: null });
    expect(queries[0].call('delete')).toEqual([]);
    expect(queries[0].call('eq')).toEqual(['business_id', 'b4']);
  });

  it('maps Supabase errors to i18n keys', async () => {
    const { repo } = setup(failure());

    expect((await repo.getFavoriteIds()).errorKey).toBe('businesses.errors.favoritesFailed');
    expect((await repo.add('b4')).errorKey).toBe('businesses.errors.favoriteSaveFailed');
    expect((await repo.remove('b4')).errorKey).toBe('businesses.errors.favoriteSaveFailed');
  });
});
