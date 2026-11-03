import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { createFakeSupabase, ok } from '../../../../testing/fake-supabase';
import type { FakeResponse } from '../../../../testing/fake-supabase';
import type { NewBusinessInput } from './business-write.schemas';
import { PanelQueryLog } from '../diagnostics/panel-query-log';
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
  const row = (id: string, owner_id: string) => ({ id, name: id, category: 'Bar', is_active: true, owner_id });

  it('lists only the signed-in user businesses', async () => {
    const { repo, queries } = setup({ businesses: ok([row('b1', 'u1')]) });

    expect(await repo.listMine()).toEqual({
      data: [{ id: 'b1', name: 'b1', category: 'Bar', is_active: true }],
      errorKey: null,
    });
    expect(queries[0].call('eq')).toEqual(['owner_id', 'u1']);
  });

  it('two owners: rows of another owner never reach the panel', async () => {
    const rows = [row('a1', 'u1'), row('b1', 'u2'), row('b2', 'u2'), row('a2', 'u1'), row('c1', 'u3')];
    const first = setup({ businesses: ok(rows) }, 'u1');
    expect((await first.repo.listMine()).data?.map((b) => b.id)).toEqual(['a1', 'a2']);
    TestBed.resetTestingModule();
    const second = setup({ businesses: ok(rows) }, 'u2');
    expect((await second.repo.listMine()).data?.map((b) => b.id)).toEqual(['b1', 'b2']);
  });

  it('records each read for "Información técnica": table, filter and rows, never the rows themselves', async () => {
    const { repo } = setup({ businesses: ok([row('a1', 'u1'), row('x9', 'u2')]) }, 'u1');
    await repo.listMine();

    expect(TestBed.inject(PanelQueryLog).entries()[0]).toMatchObject({ table: 'businesses', filter: 'owner_id = u1…', rows: 2 });
  });

  it('scopes every panel write to the owner', async () => {
    const { repo, queries } = setup({ businesses: ok(null) });
    await repo.setPublished('b1', false);
    await repo.updateContact('b1', { whatsapp: null, instagram: null, facebook: null, website: null });

    for (const query of queries) expect(query.calls).toContainEqual(['eq', ['owner_id', 'u1']]);
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
