import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { createFakeSupabase, failure, ok } from '../../../../testing/fake-supabase';
import type { FakeResponse } from '../../../../testing/fake-supabase';
import { BusinessRepository } from './business.repository';

function setup(response: FakeResponse) {
  const fake = createFakeSupabase({ business_hours: response, businesses: response });
  TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: fake }] });
  return { repo: TestBed.inject(BusinessRepository), queries: fake.queries };
}

describe('BusinessRepository.getHoursFor', () => {
  it('reads the schedules of many businesses in one query', async () => {
    const row = { business_id: 'b1', day_of_week: 1 };
    const { repo, queries } = setup(ok([row]));

    expect(await repo.getHoursFor(['b1', 'b2'])).toEqual({ data: [row], errorKey: null });
    expect(queries).toHaveLength(1);
    expect(queries[0].call('in')).toEqual(['business_id', ['b1', 'b2']]);
  });

  it('maps errors to an i18n key and skips empty lists', async () => {
    const { repo, queries } = setup(failure());

    expect(await repo.getHoursFor(['b1'])).toEqual({
      data: null,
      errorKey: 'businesses.errors.hoursFailed',
    });
    expect(await repo.getHoursFor([])).toEqual({ data: [], errorKey: null });
    expect(queries).toHaveLength(1);
  });
});

describe('BusinessRepository.getByIds', () => {
  it('reads active businesses by id in one query', async () => {
    const { repo, queries } = setup(ok([{ id: 'b1' }]));

    expect(await repo.getByIds(['b1', 'b2'])).toEqual({ data: [{ id: 'b1' }], errorKey: null });
    expect(queries[0].table).toBe('businesses');
    expect(queries[0].call('in')).toEqual(['id', ['b1', 'b2']]);
    expect(queries[0].call('eq')).toEqual(['is_active', true]);
  });

  it('maps errors to an i18n key', async () => {
    const { repo } = setup(failure());

    expect(await repo.getByIds(['b1'])).toEqual({
      data: null,
      errorKey: 'businesses.errors.loadFailed',
    });
  });
});
