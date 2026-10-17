import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { createFakeSupabase, ok } from '../../../../testing/fake-supabase';
import type { FakeResponse } from '../../../../testing/fake-supabase';
import type { NewBusinessInput } from './business-write.schemas';
import { OwnedBusinessRepository } from './owned-business.repository';

const draft: NewBusinessInput = {
  name: '  Fritanga Don Segundo ',
  category: 'Restaurante',
  phone: '+57 300 111 2233',
  address: 'Calle 18 # 25-30',
  latitude: 1.2136,
  longitude: -77.2811,
};

function setup(responses: Record<string, FakeResponse>, userId: string | null = 'u1') {
  const fake = createFakeSupabase(responses);
  TestBed.configureTestingModule({
    providers: [
      { provide: SupabaseService, useValue: fake },
      { provide: AuthService, useValue: { user: signal(userId ? { id: userId } : null) } },
    ],
  });
  return { repo: TestBed.inject(OwnedBusinessRepository), queries: fake.queries };
}

describe('OwnedBusinessRepository', () => {
  it('lists only the signed-in user businesses', async () => {
    const { repo, queries } = setup({ businesses: ok([{ id: 'b1' }]) });

    expect(await repo.listMine()).toEqual({ data: [{ id: 'b1' }], errorKey: null });
    expect(queries[0].call('eq')).toEqual(['owner_id', 'u1']);
  });

  it('creates an unpublished business for the user, trimmed', async () => {
    const { repo, queries } = setup({ businesses: ok({ id: 'new-id' }) });

    expect(await repo.create(draft)).toEqual({ data: 'new-id', errorKey: null });
    expect(queries[0].call('insert')?.[0]).toEqual({
      ...draft,
      name: 'Fritanga Don Segundo',
      owner_id: 'u1',
      is_active: false,
    });
  });

  it('rejects invalid input without calling the database', async () => {
    const { repo, queries } = setup({});

    const result = await repo.create({
      ...draft,
      category: 'Casino' as NewBusinessInput['category'],
    });

    expect(result.errorKey).toBe('businessPanel.errors.invalidData');
    expect(queries).toHaveLength(0);
  });

  it('maps the publishing guard to a translated error', async () => {
    const { repo } = setup({
      businesses: { data: null, error: { code: 'P0001', message: 'publish_requirements_missing' } },
    });

    expect((await repo.setPublished('b1', true)).errorKey).toBe(
      'businessPanel.errors.publishRequirements',
    );
  });

  it('never exposes raw database messages', async () => {
    const { repo } = setup({
      businesses: { data: null, error: { code: '23514', message: 'violates x' } },
    });

    const result = await repo.updateInfo('b1', { ...draft, description: null, prep_minutes: 20 });

    expect(result).toEqual({ data: null, errorKey: 'businessPanel.errors.invalidData' });
  });

  it('reads one of the user businesses by id and owner', async () => {
    const { repo, queries } = setup({ businesses: ok(null) });

    expect(await repo.getMine('b9')).toEqual({ data: null, errorKey: null });
    expect(queries[0].calls.filter(([m]) => m === 'eq').map(([, a]) => a)).toEqual([
      ['id', 'b9'],
      ['owner_id', 'u1'],
    ]);
  });
});
